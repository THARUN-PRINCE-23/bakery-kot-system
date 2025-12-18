import dotenv from "dotenv";
import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";

import itemRoutes from "./routes/items.js";
import orderRoutes from "./routes/orders.js";

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/bakery";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

// Simple event broker so routes can emit to Socket.io without tight coupling
export const createIOEmitter = (io) => ({
  emitOrderUpdate: (order) => io.emit("order:update", order),
  emitOrderList: (orders) => io.emit("order:list", orders),
});

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error", err);
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

  app.use("/api/items", itemRoutes);
  app.use("/api/orders", orderRoutes);

  io.on("connection", (socket) => {
    console.log("Socket connected", socket.id);
    socket.on("disconnect", () => console.log("Socket disconnected", socket.id));
  });

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start();

