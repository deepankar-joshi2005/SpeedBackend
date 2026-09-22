import { Schema, model, Document } from "mongoose";

export interface ISuccessStory extends Document {
  studentName: string;
  studentImage?: string;
  examTag: string;
  reviewText: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const successStorySchema = new Schema<ISuccessStory>(
  {
    studentName: { type: String, required: true },
    studentImage: { type: String, default: "" },
    examTag: { type: String, required: true },
    reviewText: { type: String, required: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default model<ISuccessStory>("SuccessStory", successStorySchema);
