import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    tableNumber: { type: Number, required: true },
    items: { type: [OrderItemSchema], required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["OPEN", "BILLED"],
      default: "OPEN",
    },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Order", OrderSchema);

