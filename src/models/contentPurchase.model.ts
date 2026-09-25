import mongoose, { Schema, Document, Types } from "mongoose";

export type ContentItemType = "pyq" | "ebook";

export interface IContentPurchase extends Document {
  user: Types.ObjectId;
  itemType: ContentItemType;
  itemId: Types.ObjectId;
  amountPaid: number;
  isCoachingStudent: boolean;
  paymentId: string;
  status: string;
  createdAt: Date;
}

const contentPurchaseSchema = new Schema<IContentPurchase>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  itemType: { type: String, enum: ["pyq", "ebook"], required: true },
  itemId: { type: Schema.Types.ObjectId, required: true, index: true },
  amountPaid: { type: Number, required: true },
  isCoachingStudent: { type: Boolean, default: false },
  paymentId: { type: String, required: true },
  status: { type: String, default: "success" },
  createdAt: { type: Date, default: Date.now },
});

// One purchase document per user per item
contentPurchaseSchema.index({ user: 1, itemType: 1, itemId: 1 }, { unique: true });

export default mongoose.model<IContentPurchase>("ContentPurchase", contentPurchaseSchema);
