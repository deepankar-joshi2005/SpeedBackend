import { Response } from "express";
import SupportTicket from "../models/supportTicket.model";
import { AuthRequest } from "../middleware/auth.middleware";

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { subject, message } = req.body as { subject?: string; message?: string };

    if (!subject || !subject.trim()) {
      res.status(400).json({ message: "Subject is required" });
      return;
    }
    if (!message || !message.trim()) {
      res.status(400).json({ message: "Message is required" });
      return;
    }

    const ticket = await SupportTicket.create({
      user: userId,
      subject: subject.trim(),
      message: message.trim(),
    });

    res.status(201).json({
      id: ticket._id,
      subject: ticket.subject,
      message: ticket.message,
      status: ticket.status,
      createdAt: ticket.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit support request", error });
  }
};

export const getTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const tickets = await SupportTicket.find({ user: userId }).sort({ createdAt: -1 });

    res.status(200).json(
      tickets.map((t) => ({
        id: t._id,
        subject: t.subject,
        message: t.message,
        status: t.status,
        createdAt: t.createdAt,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to load support tickets", error });
  }
};
