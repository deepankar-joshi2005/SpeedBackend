import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPurchase extends Document {
  user: Types.ObjectId;
  testSeries: Types.ObjectId;
  amountPaid: number;
  isCoachingStudent: boolean;
  paymentId: string;
  status: string;
  createdAt: Date;
}

const purchaseSchema = new Schema<IPurchase>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  testSeries: { type: Schema.Types.ObjectId, ref: "TestSeries", required: true, index: true },
  amountPaid: { type: Number, required: true },
  isCoachingStudent: { type: Boolean, default: false },
  paymentId: { type: String, required: true },
  status: { type: String, default: "success" },
  createdAt: { type: Date, default: Date.now },
});

// Ensure a user has at most one purchase document per test series
purchaseSchema.index({ user: 1, testSeries: 1 }, { unique: true });

export default mongoose.model<IPurchase>("Purchase", purchaseSchema);
