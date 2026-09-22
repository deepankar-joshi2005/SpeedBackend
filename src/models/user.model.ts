import mongoose, { Schema, Document } from "mongoose";

export const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Bengali"] as const;
export type Language = (typeof LANGUAGES)[number];

export const ROLES = ["student", "admin"] as const;
export type Role = (typeof ROLES)[number];

export interface IUser extends Document {
  name: string;
  email: string;
  mobile: string;
  password: string;
  city: string;
  state: string;
  preferredLanguage: Language;
  role: Role;
  isCoachingStudent: boolean;
  purchasedSeries: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  city: { type: String, default: "", trim: true },
  state: { type: String, default: "", trim: true },
  preferredLanguage: { type: String, enum: LANGUAGES, default: "English" },
  role: { type: String, enum: ROLES, default: "student" },
  isCoachingStudent: { type: Boolean, default: false },
  purchasedSeries: [{ type: Schema.Types.ObjectId, ref: "TestSeries" }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IUser>("User", userSchema);
