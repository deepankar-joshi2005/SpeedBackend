import { Schema, model, Document } from "mongoose";

export interface IBanner extends Document {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  linkUrl?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<IBanner>(
  {
    imageUrl: { type: String, required: true },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    linkUrl: { type: String, default: "" },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model<IBanner>("Banner", bannerSchema);
