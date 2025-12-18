import dotenv from "dotenv";
dotenv.config(); // Ensure this is called first

import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import itemRoutes from "./routes/items.js";
import orderRoutes from "./routes/orders.js";

const PORT = process.env.PORT || 4000;
// STRICTLY read from environment variable for Render deployment
const MONGO_URI = process.env.MONGO_URI;

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const SHOP_LAT = process.env.SHOP_LAT ? Number(process.env.SHOP_LAT) : undefined;
const SHOP_LNG = process.env.SHOP_LNG ? Number(process.env.SHOP_LNG) : undefined;
const SHOP_RADIUS_METERS = process.env.SHOP_RADIUS_METERS
  ? Number(process.env.SHOP_RADIUS_METERS)
  : 100;

// Simple event broker so routes can emit to Socket.io without tight coupling
export const createIOEmitter = (io) => ({
  emitOrderUpdate: (order) => io.emit("order:update", order),
  emitOrderList: (orders) => io.emit("order:list", orders),
});

async function start() {
  if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in environment variables.");
    process.exit(1);
  }

  try {
    // Connect to MongoDB Atlas
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }

  const app = express();
  app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());

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
      if (!JWT_SECRET || !ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
        return res.status(500).json({ error: "Auth is not configured" });
      }
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      if (username !== ADMIN_USERNAME) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      if (!ok) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign(
        { role: "admin", username },
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

  app.post("/api/auth/customer-location", async (req, res) => {
    try {
      const { lat, lng } = req.body || {};
      if (!JWT_SECRET || SHOP_LAT === undefined || SHOP_LNG === undefined) {
        return res.status(500).json({ error: "Location verification not configured" });
      }
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "lat and lng must be numbers" });
      }
      const dist = haversineMeters(lat, lng, SHOP_LAT, SHOP_LNG);
      if (dist > SHOP_RADIUS_METERS) {
        return res.status(403).json({ error: "Outside shop radius" });
      }
      const token = jwt.sign(
        { role: "customer" },
        JWT_SECRET,
        { expiresIn: "5m" }
      );
      res.json({ token, expiresInSeconds: 300 });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

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
