import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Item from "../models/Item.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/bakery";
const menuPath = path.join(process.cwd(), "seed", "menu.json");

async function seed() {
  const raw = fs.readFileSync(menuPath, "utf-8");
  const items = JSON.parse(raw);
  if (!Array.isArray(items)) throw new Error("menu.json must be an array");

  await mongoose.connect(MONGO_URI);
  await Item.deleteMany({});
  await Item.insertMany(items);
  console.log(`Inserted ${items.length} items`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

