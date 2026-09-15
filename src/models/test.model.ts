import mongoose, { Schema, Document, Types } from "mongoose";

export type TestStatus = "draft" | "published";
export type MaxAttempts = number; // 0 = unlimited, else exact attempt count

export interface ISubjectSection {
  name: string;
  startNo: number;
  endNo: number;
}

export interface ITest extends Document {
  series: Types.ObjectId;
  title: string;
  subject: string;
  description: string;
  totalQuestions: number;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  negativeMarkingEnabled: boolean;
  negativeMarks: number;
  maxAttempts: MaxAttempts;
  difficulty: string;
  startDate: Date | null;
  endDate: Date | null;
  status: TestStatus;
  order: number;
  subjectSections: ISubjectSection[];
  createdAt: Date;
}

const subjectSectionSchema = new Schema<ISubjectSection>(
  {
    name: { type: String, required: true, trim: true },
    startNo: { type: Number, required: true },
    endNo: { type: Number, required: true },
  },
  { _id: false }
);

const testSchema = new Schema<ITest>({
  series: { type: Schema.Types.ObjectId, ref: "TestSeries", required: true, index: true },
  title: { type: String, required: true, trim: true },
  subject: { type: String, default: "Multiple Subjects", trim: true },
  description: { type: String, default: "" },
  totalQuestions: { type: Number, default: 0 },
  durationMinutes: { type: Number, default: 60 },
  totalMarks: { type: Number, default: 0 },
  passingMarks: { type: Number, default: 0 },
  negativeMarkingEnabled: { type: Boolean, default: true },
  negativeMarks: { type: Number, required: true, default: 0.25 },
  maxAttempts: { type: Number, default: 1 },
  difficulty: { type: String, required: true, default: "Mixed", trim: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  status: { type: String, enum: ["draft", "published"], default: "draft" },
  order: { type: Number, default: 0 },
  subjectSections: { type: [subjectSectionSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ITest>("Test", testSchema);
