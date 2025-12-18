import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, default: "General" },
    price: { type: Number, required: true },
    imageUrl: { type: String, default: "" },
    available: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Item", ItemSchema);

