import mongoose, { Document, Schema, Types } from "mongoose";
import { ContentItemType } from "./contentPurchase.model";

export interface IContentOrder extends Document {
  user: Types.ObjectId;
  itemType: ContentItemType;
  itemId: Types.ObjectId;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  status: "created" | "paid" | "failed";
  createdAt: Date;
}

const contentOrderSchema = new Schema<IContentOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    itemType: { type: String, enum: ["pyq", "ebook"], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IContentOrder>("ContentOrder", contentOrderSchema);
