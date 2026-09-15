import mongoose, { Schema, Document, Types } from "mongoose";

export type TicketStatus = "open" | "resolved";

export interface ISupportTicket extends Document {
  user: Types.ObjectId;
  subject: string;
  message: string;
  status: TicketStatus;
  createdAt: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  status: { type: String, enum: ["open", "resolved"], default: "open" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ISupportTicket>("SupportTicket", supportTicketSchema);
