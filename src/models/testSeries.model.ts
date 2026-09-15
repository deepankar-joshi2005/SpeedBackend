import mongoose, { Schema, Document } from "mongoose";

export type AccessType = "free" | "paid";
export type SeriesStatus = "draft" | "published";

export interface ITestSeries extends Document {
  title: string;
  category: string;
  examTarget: string;
  description: string;
  shortDescription: string;
  bannerImage: string | null;
  totalPapers: number;
  unitLabel: string;
  totalQuestions: number;
  durationMinutes: number;
  difficulty: string;
  accessType: AccessType;
  price: number;
  validityMonths: number;
  startDate: Date | null;
  endDate: Date | null;
  isPublic: boolean;
  isAvailable: boolean;
  status: SeriesStatus;
  createdAt: Date;
}

const testSeriesSchema = new Schema<ITestSeries>({
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true, index: true },
  examTarget: { type: String, default: "", trim: true },
  description: { type: String, default: "" },
  shortDescription: { type: String, default: "" },
  bannerImage: { type: String, default: null },
  totalPapers: { type: Number, default: 0 },
  unitLabel: { type: String, default: "Full Mock Tests" },
  totalQuestions: { type: Number, default: 0 },
  durationMinutes: { type: Number, default: 60 },
  difficulty: { type: String, default: "Mixed" },
  accessType: { type: String, enum: ["free", "paid"], default: "paid" },
  price: { type: Number, default: 0 },
  validityMonths: { type: Number, default: 12 },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  isPublic: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  status: { type: String, enum: ["draft", "published"], default: "draft" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ITestSeries>("TestSeries", testSeriesSchema);
