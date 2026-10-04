import mongoose, { Schema, Document, Types } from "mongoose";

export type TestStatus = "draft" | "published";
export type MaxAttempts = number; // 0 = unlimited, else exact attempt count
export type TestAccessLevel = "all" | "coachingOnly";

export interface ISubjectSection {
  name: string;
  startNo: number;
  endNo: number;
  durationMinutes?: number;
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
  // "HH:mm" 24-hour strings, optional. When set they combine with
  // startDate/endDate to produce an exact live/attempt/result window; when
  // null, scheduling stays purely date-based (today's existing behaviour).
  // See src/utils/testSchedule.ts.
  startTime: string | null;
  endTime: string | null;
  status: TestStatus;
  order: number;
  subjectSections: ISubjectSection[];
  divideSectionsByTime: boolean;
  sectionOrder: string[];
  accessLevel: TestAccessLevel;
  isFreeDemo: boolean;
  // Opt-in: only tests an admin explicitly added show up in the student
  // Home screen's Upcoming/Live Mocks carousels. Which of the two it falls
  // into is still fully dynamic (see src/utils/testSchedule.ts) — this flag
  // only gates whether the test is in that pool at all.
  addedToUpcomingMocks: boolean;
  createdAt: Date;
}

const subjectSectionSchema = new Schema<ISubjectSection>(
  {
    name: { type: String, required: true, trim: true },
    startNo: { type: Number, required: true },
    endNo: { type: Number, required: true },
    durationMinutes: { type: Number },
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
  startTime: { type: String, default: null },
  endTime: { type: String, default: null },
  status: { type: String, enum: ["draft", "published"], default: "draft" },
  order: { type: Number, default: 0 },
  subjectSections: { type: [subjectSectionSchema], default: [] },
  divideSectionsByTime: { type: Boolean, default: false },
  sectionOrder: { type: [String], default: [] },
  accessLevel: { type: String, enum: ["all", "coachingOnly"], default: "coachingOnly" },
  isFreeDemo: { type: Boolean, default: false },
  addedToUpcomingMocks: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ITest>("Test", testSchema);
