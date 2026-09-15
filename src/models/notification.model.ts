import mongoose, { Schema, Document, Types } from "mongoose";

export type NotificationType = "result" | "system";

export interface INotification extends Document {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  testId?: Types.ObjectId;
  attemptId?: Types.ObjectId;
  category?: string;
  targetScreen?: string;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["result", "system"], default: "system" },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  testId: { type: Schema.Types.ObjectId, ref: "Test", default: null },
  attemptId: { type: Schema.Types.ObjectId, ref: "TestAttempt", default: null },
  category: { type: String, default: null },
  targetScreen: { type: String, default: null },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<INotification>("Notification", notificationSchema);
