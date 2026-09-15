import mongoose, { Schema, Document } from "mongoose";

export interface ITestPaper extends Document {
  title: string;
  subject: string;
  totalMarks: number;
  createdAt: Date;
}

const testPaperSchema = new Schema<ITestPaper>({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  totalMarks: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ITestPaper>("TestPaper", testPaperSchema);
