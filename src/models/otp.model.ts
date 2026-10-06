import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
  target: string;
  type: "email" | "mobile";
  otp: string;
  isVerified: boolean;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>({
  target: { type: String, required: true, index: true },
  type: { type: String, enum: ["email", "mobile"], required: true },
  otp: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 600 }, // 10 minutes TTL
});

export default mongoose.model<IOtp>("Otp", otpSchema);
