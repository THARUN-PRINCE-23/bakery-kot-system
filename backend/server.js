import dotenv from "dotenv";
dotenv.config(); // Ensure this is called first

import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "fs";
import path from "path";
import Item from "./models/Item.js";

import itemRoutes from "./routes/items.js";
import orderRoutes from "./routes/orders.js";

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/bakery";
const USE_MEMORY_DB = process.env.USE_MEMORY_DB === "true";

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  process.env.JWT_SECRET = "dev-secret";
  JWT_SECRET = process.env.JWT_SECRET;
}
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const DEFAULT_ADMIN = {
  username: "admin",
  passwordHash: "$2b$10$nnV/hEz0JU.xOnzsAJY3bOgq.y4/Iqu6VsSaAeDyPOkXrSQFZ7Uk6",
};
const SHOP_RADIUS_METERS = process.env.SHOP_RADIUS_METERS
  ? Number(process.env.SHOP_RADIUS_METERS)
  : 100;
const DISABLE_LOCATION_CHECK = process.env.DISABLE_LOCATION_CHECK === "true";
let SHOP_POINTS = [];
try {
  if (process.env.SHOP_POINTS) {
    const parsed = JSON.parse(process.env.SHOP_POINTS);
    if (Array.isArray(parsed)) SHOP_POINTS = parsed;
  }
} catch {}
// Fallback to the two provided points if not configured via env
if (SHOP_POINTS.length === 0) {
  SHOP_POINTS = [
    { lat: 11.466774084072942, lng: 78.18909983121073 },
    { lat: 11.486040516888176, lng: 78.18492438460116 },
  ];
}

// Simple event broker so routes can emit to Socket.io without tight coupling
export const createIOEmitter = (io) => ({
  emitOrderUpdate: (order) => io.emit("order:update", order),
  emitOrderList: (orders) => io.emit("order:list", orders),
});

async function start() {
  let connected = false;
  try {
    await mongoose.connect(MONGO_URI);
    connected = true;
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
  if (!connected && USE_MEMORY_DB) {
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    connected = true;
    console.log("Connected to in-memory MongoDB");
    process.on("SIGINT", async () => {
      await mongod.stop();
      process.exit(0);
    });
  }
  if (!connected) {
    process.exit(1);
  }

  const app = express();
  app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());

  try {
    const count = await Item.countDocuments();
    if (count === 0) {
      const menuPath = path.join(process.cwd(), "seed", "menu.json");
      const raw = fs.readFileSync(menuPath, "utf-8");
      const items = JSON.parse(raw);
      if (Array.isArray(items) && items.length > 0) {
        await Item.insertMany(items);
      }
    }
  } catch {}

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST", "PATCH"] },
  });
  const ioEmitter = createIOEmitter(io);

  // Attach ioEmitter to request for routes that need to broadcast
  app.use((req, res, next) => {
    req.ioEmitter = ioEmitter;
    next();
  });

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Auth endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!JWT_SECRET) {
        return res.status(500).json({ error: "Auth is not configured" });
      }
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      const effectiveUsername = ADMIN_USERNAME || DEFAULT_ADMIN.username;
      const effectiveHash = ADMIN_PASSWORD_HASH || DEFAULT_ADMIN.passwordHash;
      if (username !== effectiveUsername) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const ok = await bcrypt.compare(password, effectiveHash);
      if (!ok) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign(
        { role: "admin", username: effectiveUsername },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({ token });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Haversine distance helper
  const toRad = (v) => (v * Math.PI) / 180;
  const haversineMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const issueCustomerToken = (_req, res) => {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: "Auth is not configured" });
    }
    const token = jwt.sign({ role: "customer" }, JWT_SECRET, { expiresIn: "5m" });
    res.json({ token, expiresInSeconds: 300 });
  };
  app.post("/api/auth/customer", issueCustomerToken);
  app.post("/api/auth/customer-location", issueCustomerToken);

  app.use("/api/items", itemRoutes);
  app.use("/api/orders", orderRoutes);

  io.on("connection", (socket) => {
    console.log("Socket connected", socket.id);
    socket.on("disconnect", () => console.log("Socket disconnected", socket.id));
  });

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
