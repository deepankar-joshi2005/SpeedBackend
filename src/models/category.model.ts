import mongoose, { Schema, Document } from "mongoose";

export interface ICategory extends Document {
  name: string;
  description: string;
  iconKey: string;
  iconImage: string | null;
  bannerImage: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: "", trim: true },
  iconKey: { type: String, default: "book-outline" },
  iconImage: { type: String, default: null },
  bannerImage: { type: String, default: null },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ICategory>("Category", categorySchema);
