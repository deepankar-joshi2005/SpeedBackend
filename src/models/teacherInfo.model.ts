import { Schema, model, Document } from "mongoose";

export interface ITeacherInfo extends Document {
  name: string;
  title: string;
  designation: string;
  imageUrl?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

const teacherInfoSchema = new Schema<ITeacherInfo>(
  {
    name: { type: String, required: true, default: "Admin Sir" },
    title: { type: String, required: true, default: "Meet the Minds Behind Speed Education" },
    designation: { type: String, required: true, default: "Founder & Chief Instructor" },
    imageUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
  },
  { timestamps: true }
);

export default model<ITeacherInfo>("TeacherInfo", teacherInfoSchema);
