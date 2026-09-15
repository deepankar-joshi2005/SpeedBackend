import mongoose, { Schema, Document, Types } from "mongoose";

export const DIFFICULTIES = ["Easy", "Moderate", "Hard"] as const;
export type QuestionDifficulty = (typeof DIFFICULTIES)[number];

export interface IQuestion extends Document {
  test: Types.ObjectId | null;
  bankId: Types.ObjectId;
  subject: string;
  topic: string;
  text: string;
  image: string | null;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  difficulty: QuestionDifficulty;
  marks: number;
  negativeMarks: number;
  order: number;
  createdAt: Date;
}

const questionSchema = new Schema<IQuestion>({
  test: { type: Schema.Types.ObjectId, ref: "Test", default: null, index: true },
  bankId: { type: Schema.Types.ObjectId, index: true },
  subject: { type: String, required: true, trim: true },
  topic: { type: String, default: "", trim: true },
  text: { type: String, required: true, trim: true },
  image: { type: String, default: null },
  options: { type: [String], required: true, validate: (v: string[]) => v.length === 4 },
  correctOptionIndex: { type: Number, required: true, min: 0, max: 3 },
  explanation: { type: String, default: "" },
  difficulty: { type: String, enum: DIFFICULTIES, default: "Moderate" },
  marks: { type: Number, default: 2 },
  negativeMarks: { type: Number, default: 0.25 },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

questionSchema.pre("validate", function () {
  if (!this.bankId) {
    this.bankId = this._id as Types.ObjectId;
  }
});

export default mongoose.model<IQuestion>("Question", questionSchema);
