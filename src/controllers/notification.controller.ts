import { Response } from "express";
import Notification, { NotificationType } from "../models/notification.model";
import User from "../models/user.model";
import { AuthRequest } from "../middleware/auth.middleware";

export async function notifyAllStudents(
  title: string,
  message: string,
  type: NotificationType = "system",
  extraData: {
    testId?: unknown;
    attemptId?: unknown;
    category?: string | null;
    targetScreen?: string | null;
  } = {}
): Promise<void> {
  try {
    const students = await User.find({ role: { $ne: "admin" } }, "_id");
    if (!students || students.length === 0) return;
    await Notification.insertMany(
      students.map((s) => ({
        user: s._id,
        type,
        title,
        message,
        testId: extraData.testId || null,
        attemptId: extraData.attemptId || null,
        category: extraData.category || null,
        targetScreen: extraData.targetScreen || null,
        isRead: false,
        createdAt: new Date(),
      }))
    );
  } catch (error) {
    console.error("Failed to notify students:", error);
  }
}

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50),
      Notification.countDocuments({ user: userId, isRead: false }),
    ]);

    res.status(200).json({
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        testId: n.testId ? String(n.testId) : null,
        attemptId: n.attemptId ? String(n.attemptId) : null,
        category: n.category ?? null,
        targetScreen: n.targetScreen ?? null,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load notifications", error });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { notificationId } = req.params;
    await Notification.updateOne({ _id: notificationId, user: userId }, { isRead: true });
    res.status(200).json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update notification", error });
  }
};

export const markAllNotificationsRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId as string;
    await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update notifications", error });
  }
};
