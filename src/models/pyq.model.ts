import { Schema, model, Document } from "mongoose";

export type PyqAccessType = "free" | "paid";

export interface IPyq extends Document {
  title: string;
  category: string;
  examName: string;
  year: number;
  fileUrl: string;
  fileSize: number;
  accessType: PyqAccessType;
  price: number;
  coachingPrice: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pyqSchema = new Schema<IPyq>(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    examName: { type: String, required: true, trim: true, index: true },
    year: { type: Number, required: true },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    accessType: { type: String, enum: ["free", "paid"], default: "free" },
    price: { type: Number, default: 0 },
    coachingPrice: { type: Number, default: 0 },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model<IPyq>("Pyq", pyqSchema);
