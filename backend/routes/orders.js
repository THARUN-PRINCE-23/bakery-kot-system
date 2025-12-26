import express from "express";
import Order from "../models/Order.js";
import Item from "../models/Item.js";
import { printBill, printKot } from "../print/printer.js";
import jwt from "jsonwebtoken";

const router = express.Router();

const requireRole = (roles) => (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!roles.includes(payload.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  } catch (err) {
    const code =
      err && (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError")
        ? 401
        : 400;
    res.status(code).json({ error: "Invalid or expired token" });
  }
};

const customerSessionOrRefresh = (tableResolver) => async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    let ok = false;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        ok = payload && payload.role === "customer";
      } catch {}
    }
    const t = Number(tableResolver(req));
    const validTable = Number.isFinite(t) && t > 0;
    if (!ok && validTable) {
      const newToken = jwt.sign({ role: "customer" }, process.env.JWT_SECRET, {
        expiresIn: "5m",
      });
      res.setHeader("x-new-token", newToken);
      req.headers.authorization = `Bearer ${newToken}`;
      ok = true;
    }
    if (!ok) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    next();
  } catch {
    res.status(400).json({ error: "Invalid or expired token" });
  }
};

// Utility to broadcast updates
const emitOrders = async (ioEmitter) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  ioEmitter.emitOrderList(orders);
};

// Create or append to OPEN order for a table
router.post("/", customerSessionOrRefresh((req) => req.body?.tableNumber), async (req, res) => {
  try {
    const { tableNumber, items, note } = req.body;
    if (!tableNumber || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Table and items required" });
    }

    // Fetch latest prices/names from DB for safety
    const itemIds = items.map((i) => i.itemId);
    const dbItems = await Item.find({ _id: { $in: itemIds }, available: true });
    const dbMap = Object.fromEntries(dbItems.map((i) => [i.id, i]));

    const orderItems = items.map((i) => {
      const dbItem = dbMap[i.itemId];
      if (!dbItem) throw new Error(`Item not available: ${i.itemId}`);
      return {
        itemId: dbItem.id,
        name: dbItem.name,
        price: dbItem.price,
        quantity: i.quantity || 1,
      };
    });

    const existing = await Order.findOne({ tableNumber, status: "OPEN" });
    if (existing) {
      const merged = [...existing.items];
      for (const ni of orderItems) {
        const idx = merged.findIndex((m) => String(m.itemId) === String(ni.itemId));
        if (idx >= 0) {
          merged[idx].quantity += ni.quantity;
        } else {
          merged.push(ni);
        }
      }
      const total = merged.reduce((sum, i) => sum + i.price * i.quantity, 0);
      existing.items = merged;
      existing.total = total;
      existing.note = note || existing.note || "";
      await existing.save();
      req.ioEmitter.emitOrderUpdate(existing);
      await emitOrders(req.ioEmitter);
      return res.json(existing);
    } else {
      const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const order = await Order.create({
        tableNumber,
        items: orderItems,
        total,
        status: "OPEN",
        note: note || "",
      });
      // Print KOT
      printKot(order).catch((err) =>
        console.error("KOT print failed:", err)
      );

      req.ioEmitter.emitOrderUpdate(order);
      await emitOrders(req.ioEmitter);
      return res.status(201).json(order);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List orders
router.get("/", requireRole(["admin"]), async (_req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// Get running order for a table (for customers)
router.get(
  "/by-table/:tableNumber",
  customerSessionOrRefresh((req) => req.params?.tableNumber),
  async (req, res) => {
  const tableNumber = Number(req.params.tableNumber);
  if (!Number.isFinite(tableNumber)) {
    return res.status(400).json({ error: "Invalid table number" });
  }
  const order = await Order.findOne({ tableNumber, status: "OPEN" }).sort({ createdAt: -1 });
  res.json(order || null);
}
);

// Update status
router.patch("/:id/status", requireRole(["admin"]), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["OPEN", "BILLED"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });

    req.ioEmitter.emitOrderUpdate(order);
    await emitOrders(req.ioEmitter);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Print bill (stub) and mark billed
router.post("/:id/print", requireRole(["admin"]), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const printResult = await printBill(order);

    order.status = "BILLED";
    await order.save();

    req.ioEmitter.emitOrderUpdate(order);
    await emitOrders(req.ioEmitter);

    res.json({ success: true, printResult, order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Print KOT stub without changing status
router.post("/:id/print-kot", requireRole(["admin"]), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const printResult = await printKot(order);

    req.ioEmitter.emitOrderUpdate(order);
    await emitOrders(req.ioEmitter);

    res.json({ success: true, printResult, order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/:id", requireRole(["admin"]), async (req, res) => {
  try {
    const id = req.params.id;
    const { tableNumber, note, items } = req.body || {};
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (tableNumber !== undefined) {
      const t = Number(tableNumber);
      if (!Number.isFinite(t) || t <= 0) return res.status(400).json({ error: "Invalid table number" });
      order.tableNumber = t;
    }
    if (typeof note === "string") {
      order.note = note;
    }
    if (Array.isArray(items)) {
      const itemIds = items.map((i) => i.itemId);
      const dbItems = await Item.find({ _id: { $in: itemIds }, available: true });
      const dbMap = Object.fromEntries(dbItems.map((i) => [String(i.id), i]));
      const normalized = items.map((i) => {
        const key = String(i.itemId);
        const base = dbMap[key];
        const name = i.name || (base ? base.name : "");
        const price = i.price !== undefined ? Number(i.price) : base ? base.price : NaN;
        const quantity = Number(i.quantity || 0);
        if (!base && (!name || Number.isNaN(price))) throw new Error(`Item not available: ${i.itemId}`);
        return { itemId: key, name, price, quantity };
      }).filter((i) => i.quantity > 0);
      const total = normalized.reduce((sum, it) => sum + it.price * it.quantity, 0);
      order.items = normalized;
      order.total = total;
    }
    await order.save();
    req.ioEmitter.emitOrderUpdate(order);
    await emitOrders(req.ioEmitter);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", requireRole(["admin"]), async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await Order.findById(id);
    if (!existing) return res.status(404).json({ error: "Order not found" });
    await Order.deleteOne({ _id: id });
    req.ioEmitter.emitOrderUpdate({ ...existing.toObject(), _id: id, deleted: true });
    await emitOrders(req.ioEmitter);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

