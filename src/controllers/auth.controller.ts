import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User, { Role, Language } from "../models/user.model";
import { isValidEmail, isValidMobile, isStrongPassword } from "../utils/validators";
import { notifyAllAdmins } from "./notification.controller";
import { AuthRequest } from "../middleware/auth.middleware";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const TOKEN_EXPIRY = "5d";
const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000; // matches TOKEN_EXPIRY — a stale session self-heals

const signToken = (userId: string, role: Role): string =>
  jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

// A session older than the token lifetime can no longer be "logged in" for
// real (its token has expired), so treat it as free rather than locking the
// account out forever if a device was lost/uninstalled without logging out.
const isSessionStale = (activeSessionAt: Date | null | undefined): boolean => {
  if (!activeSessionAt) return true;
  return Date.now() - activeSessionAt.getTime() > SESSION_TTL_MS;
};

const claimSession = async (user: InstanceType<typeof User>): Promise<void> => {
  user.activeSessionId = crypto.randomUUID();
  user.activeSessionAt = new Date();
  await user.save();
};

const toPublicUser = (user: {
  _id: unknown;
  name: string;
  email: string;
  mobile: string;
  city?: string;
  state?: string;
  role: Role;
  preferredLanguage?: Language;
  isCoachingStudent?: boolean;
  profileImage?: string | null;
}) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  city: user.city ?? "",
  state: user.state ?? "",
  role: user.role,
  preferredLanguage: user.preferredLanguage ?? "English",
  isCoachingStudent: user.isCoachingStudent ?? false,
  profileImage: user.profileImage ?? null,
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, mobile, password, city, state } = req.body as {
      name?: string;
      email?: string;
      mobile?: string;
      password?: string;
      city?: string;
      state?: string;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Student name is required" });
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
    if (!password || !isStrongPassword(password)) {
      res.status(400).json({
        message:
          "Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number",
      });
      return;
    }
    if (!city || !city.trim()) {
      res.status(400).json({ message: "City is required" });
      return;
    }
    if (!state || !state.trim()) {
      res.status(400).json({ message: "State is required" });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      res.status(409).json({ message: "This email is already registered. Please login instead." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      mobile: mobile.trim(),
      password: hashedPassword,
      city: city.trim(),
      state: state.trim(),
      role: "student",
    });

    await notifyAllAdmins(
      "New Student Signup",
      `${user.name} (${user.mobile}) from ${user.city}, ${user.state} just signed up. Review and tag them as a Coaching Student if they're yours.`,
      "system",
      { targetScreen: "adminStudentDetail" }
    );

    await claimSession(user);
    const token = signToken(String(user._id), user.role);
    res.status(201).json({ user: toPublicUser(user), token });
  } catch (error) {
    res.status(500).json({ message: "Failed to sign up", error });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    if (user.activeSessionId && !isSessionStale(user.activeSessionAt)) {
      res.status(409).json({
        code: "ALREADY_LOGGED_IN",
        message:
          "Your account is already logged in on another device. Please logout there first, then try again here.",
      });
      return;
    }

    await claimSession(user);
    const token = signToken(String(user._id), user.role);
    res.status(200).json({ user: toPublicUser(user), token });
  } catch (error) {
    res.status(500).json({ message: "Failed to login", error });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      activeSessionId: null,
      activeSessionAt: null,
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to logout", error });
  }
};
