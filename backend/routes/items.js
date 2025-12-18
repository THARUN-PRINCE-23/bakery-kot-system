import express from "express";
import Item from "../models/Item.js";
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

router.get("/", async (_req, res) => {
  try {
    const items = await Item.find().sort({ category: 1, name: 1 });
    res.json(Array.isArray(items) ? items : []);
  } catch (err) {
    console.error("GET /api/items error:", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// Create item
router.post("/", requireRole(["admin"]), async (req, res) => {
  try {
    const item = await Item.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update item
router.patch("/:id", requireRole(["admin"]), async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete item
router.delete("/:id", requireRole(["admin"]), async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
