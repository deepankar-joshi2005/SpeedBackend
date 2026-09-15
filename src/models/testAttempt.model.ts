import mongoose, { Schema, Document, Types } from "mongoose";

export type AttemptStatus = "in-progress" | "completed";

export interface IAnswer {
  question: Types.ObjectId;
  selectedOption: number | null;
  markedForReview: boolean;
  isCorrect: boolean | null;
}

export interface ISubjectBreakdown {
  subject: string;
  correct: number;
  total: number;
}

export interface ISectionBreakdown {
  name: string;
  correct: number;
  total: number;
}

export interface ITestAttempt extends Document {
  user: Types.ObjectId;
  test: Types.ObjectId;
  title: string;
  category: string;
  totalQuestions: number;
  questionsCompleted: number;
  answers: IAnswer[];
  status: AttemptStatus;
  startedAt: Date;
  submittedAt: Date | null;
  timeTakenSeconds: number | null;
  score: number | null;
  scorePercent: number | null;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  accuracy: number | null;
  rank: number | null;
  totalCandidates: number | null;
  subjectBreakdown: ISubjectBreakdown[];
  sectionBreakdown: ISectionBreakdown[];
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new Schema<IAnswer>(
  {
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    selectedOption: { type: Number, default: null },
    markedForReview: { type: Boolean, default: false },
    isCorrect: { type: Boolean, default: null },
  },
  { _id: false }
);

const subjectBreakdownSchema = new Schema<ISubjectBreakdown>(
  {
    subject: { type: String, required: true },
    correct: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const sectionBreakdownSchema = new Schema<ISectionBreakdown>(
  {
    name: { type: String, required: true },
    correct: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const testAttemptSchema = new Schema<ITestAttempt>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  test: { type: Schema.Types.ObjectId, ref: "Test", required: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  totalQuestions: { type: Number, required: true },
  questionsCompleted: { type: Number, default: 0 },
  answers: { type: [answerSchema], default: [] },
  status: { type: String, enum: ["in-progress", "completed"], default: "in-progress" },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: null },
  timeTakenSeconds: { type: Number, default: null },
  score: { type: Number, default: null },
  scorePercent: { type: Number, default: null },
  correctCount: { type: Number, default: 0 },
  wrongCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  accuracy: { type: Number, default: null },
  rank: { type: Number, default: null },
  totalCandidates: { type: Number, default: null },
  subjectBreakdown: { type: [subjectBreakdownSchema], default: [] },
  sectionBreakdown: { type: [sectionBreakdownSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model<ITestAttempt>("TestAttempt", testAttemptSchema);
