import { Response } from "express";
import User, { LANGUAGES } from "../models/user.model";
import TestAttempt from "../models/testAttempt.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { isValidEmail, isValidMobile } from "../utils/validators";

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;

    const [user, attempts] = await Promise.all([
      User.findById(userId),
      TestAttempt.find({ user: userId, status: "completed" }),
    ]);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const testsAttempted = attempts.length;
    const totalCorrect = attempts.reduce((s, a) => s + a.correctCount, 0);
    const totalAnswered = attempts.reduce((s, a) => s + a.correctCount + a.wrongCount, 0);
    const avgAccuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const bestRank = attempts.reduce<number | null>((best, a) => {
      if (a.rank === null) return best;
      if (best === null) return a.rank;
      return Math.min(best, a.rank);
    }, null);

    res.status(200).json({
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      preferredLanguage: user.preferredLanguage,
      testsAttempted,
      avgAccuracy,
      bestRank,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load profile", error });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { name, email, mobile } = req.body as {
      name?: string;
      email?: string;
      mobile?: string;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ message: "Enter a valid email address" });
      return;
    }
    if (!mobile || !isValidMobile(mobile)) {
      res.status(400).json({ message: "Enter a valid 10-digit mobile number" });
      return;
    }

    const existing = await User.findOne({
      email: email.toLowerCase().trim(),
      _id: { $ne: userId },
    });
    if (existing) {
      res.status(409).json({ message: "This email is already in use by another account." });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { name: name.trim(), email: email.toLowerCase().trim(), mobile: mobile.trim() },
      { new: true }
    );
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error });
  }
};

export const updateLanguage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { language } = req.body as { language?: string };

    if (!language || !LANGUAGES.includes(language as (typeof LANGUAGES)[number])) {
      res.status(400).json({ message: "Unsupported language" });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { preferredLanguage: language },
      { new: true }
    );
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({ preferredLanguage: user.preferredLanguage });
  } catch (error) {
    res.status(500).json({ message: "Failed to update language", error });
  }
};
