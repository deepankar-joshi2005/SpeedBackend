import { Schema, model, Document } from "mongoose";

export type EbookAccessType = "free" | "paid";

export interface IEbook extends Document {
  title: string;
  category: string;
  author: string;
  description: string;
  coverImage: string | null;
  fileUrl: string;
  fileSize: number;
  accessType: EbookAccessType;
  price: number;
  coachingPrice: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ebookSchema = new Schema<IEbook>(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    author: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    coverImage: { type: String, default: null },
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

export default model<IEbook>("Ebook", ebookSchema);
