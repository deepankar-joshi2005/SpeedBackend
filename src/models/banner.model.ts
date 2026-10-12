import { Schema, model, Document } from "mongoose";

export interface IBanner extends Document {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  linkUrl?: string;
  // Name of an existing Category (see category.model.ts) this banner
  // represents. Required — tapping the banner on the student Home screen
  // takes the student straight to that category's Test Series list, so a
  // banner with no category would have nowhere meaningful to go.
  category: string;
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
    category: { type: String, required: true, trim: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model<IBanner>("Banner", bannerSchema);
