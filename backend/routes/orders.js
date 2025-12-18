import express from "express";
import Order from "../models/Order.js";
import Item from "../models/Item.js";
import { printBillStub } from "../print/escposStub.js";

const router = express.Router();

// Utility to broadcast updates
const emitOrders = async (ioEmitter) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  ioEmitter.emitOrderList(orders);
};

// Create order
router.post("/", async (req, res) => {
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

    const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const order = await Order.create({
      tableNumber,
      items: orderItems,
      total,
      status: "PREPARING",
      note: note || "",
    });

    req.ioEmitter.emitOrderUpdate(order);
    await emitOrders(req.ioEmitter);
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List orders
router.get("/", async (_req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// Update status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["PREPARING", "PREPARED", "BILLED"];
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
router.post("/:id/print", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const printResult = await printBillStub(order);

    order.status = "BILLED";
    await order.save();

    req.ioEmitter.emitOrderUpdate(order);
    await emitOrders(req.ioEmitter);

    res.json({ success: true, printResult, order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

