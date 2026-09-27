import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUpcomingMock extends Document {
  test: Types.ObjectId;
  seriesTitle: string;
  testTitle: string;
  totalQuestions: number;
  durationMinutes: number;
  totalMarks: number;
  category: string;
  startDate: Date;
  createdAt: Date;
}

const upcomingMockSchema = new Schema<IUpcomingMock>(
  {
    test: { type: Schema.Types.ObjectId, ref: "Test", required: true, unique: true },
    seriesTitle: { type: String, default: "" },
    testTitle: { type: String, required: true },
    totalQuestions: { type: Number, default: 0 },
    durationMinutes: { type: Number, default: 60 },
    totalMarks: { type: Number, default: 0 },
    category: { type: String, default: "" },
    startDate: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IUpcomingMock>("UpcomingMock", upcomingMockSchema);
