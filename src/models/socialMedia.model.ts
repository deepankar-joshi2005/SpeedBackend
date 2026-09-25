import { Schema, model, Document } from "mongoose";

export interface ISocialMedia extends Document {
  platform: string;
  label: string;
  link: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const socialMediaSchema = new Schema<ISocialMedia>(
  {
    platform: { type: String, required: true },
    label: { type: String, required: true },
    link: { type: String, required: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model<ISocialMedia>("SocialMedia", socialMediaSchema);
