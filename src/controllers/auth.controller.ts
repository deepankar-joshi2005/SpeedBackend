import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User, { Role, Language } from "../models/user.model";
import Otp from "../models/otp.model";
import { sendEmailOtp, sendSmsOtp } from "../services/otpSender.service";
import { isValidEmail, isValidMobile, isStrongPassword } from "../utils/validators";
import { notifyAllAdmins } from "./notification.controller";
import { AuthRequest } from "../middleware/auth.middleware";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const TOKEN_EXPIRY = "5d";
const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000; // matches TOKEN_EXPIRY — a stale session self-heals

const signToken = (userId: string, role: Role): string =>
  jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

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

export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { target } = req.body as { target?: string };
    if (!target || !target.trim()) {
      res.status(400).json({ message: "Email address or Mobile number is required" });
      return;
    }

    const cleanTarget = target.trim();
    let type: "email" | "mobile";

    if (isValidEmail(cleanTarget)) {
      type = "email";
    } else if (isValidMobile(cleanTarget)) {
      type = "mobile";
    } else {
      res.status(400).json({ message: "Please enter a valid Email address or 10-digit Mobile number" });
      return;
    }

    const formattedTarget = type === "email" ? cleanTarget.toLowerCase() : cleanTarget;

    // Check if user with this email or mobile already exists
    const existingUser = await User.findOne(
      type === "email" ? { email: formattedTarget } : { mobile: formattedTarget }
    );

    if (existingUser) {
      res.status(409).json({
        message: `This ${type === "email" ? "email address" : "mobile number"} is already registered. Please login instead.`,
      });
      return;
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete existing unverified OTP for this target
    await Otp.deleteMany({ target: formattedTarget });

    // Save new OTP
    await Otp.create({
      target: formattedTarget,
      type,
      otp: otpCode,
      isVerified: false,
    });

    // Send OTP via email or SMS
    if (type === "email") {
      await sendEmailOtp(formattedTarget, otpCode);
    } else {
      await sendSmsOtp(formattedTarget, otpCode);
    }

    res.status(200).json({
      message: `6-digit verification code sent to ${formattedTarget}`,
      target: formattedTarget,
      type,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to send OTP. Please try again.", error });
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { target, otp } = req.body as { target?: string; otp?: string };
    if (!target || !target.trim() || !otp || !otp.trim()) {
      res.status(400).json({ message: "Target (Email/Mobile) and 6-digit OTP are required" });
      return;
    }

    const cleanTarget = target.trim();
    const cleanOtp = otp.trim();
    const isEmail = isValidEmail(cleanTarget);
    const formattedTarget = isEmail ? cleanTarget.toLowerCase() : cleanTarget;

    const otpRecord = await Otp.findOne({ target: formattedTarget, otp: cleanOtp });

    if (!otpRecord) {
      res.status(400).json({ message: "Invalid or expired 6-digit OTP code. Please try again." });
      return;
    }

    otpRecord.isVerified = true;
    await otpRecord.save();

    // Generate short-lived verification token
    const verificationToken = jwt.sign(
      { target: formattedTarget, type: otpRecord.type, isVerified: true },
      JWT_SECRET,
      { expiresIn: "30m" }
    );

    res.status(200).json({
      message: "OTP verified successfully!",
      verificationToken,
      target: formattedTarget,
      type: otpRecord.type,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify OTP. Please try again.", error });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, mobile, password, city, state, verificationToken } = req.body as {
      name?: string;
      email?: string;
      mobile?: string;
      password?: string;
      city?: string;
      state?: string;
      verificationToken?: string;
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

    const cleanEmail = email.toLowerCase().trim();
    const cleanMobile = mobile.trim();

    // Verify token or DB record for OTP verification
    let verifiedTarget = "";
    if (verificationToken) {
      try {
        const decoded = jwt.verify(verificationToken, JWT_SECRET) as {
          target: string;
          type: "email" | "mobile";
          isVerified: boolean;
        };
        if (decoded && decoded.isVerified) {
          verifiedTarget = decoded.target;
        }
      } catch {
        // Invalid token
      }
    }

    if (!verifiedTarget) {
      const verifiedOtp = await Otp.findOne({
        target: { $in: [cleanEmail, cleanMobile] },
        isVerified: true,
      });
      if (verifiedOtp) {
        verifiedTarget = verifiedOtp.target;
      }
    }

    if (!verifiedTarget || (verifiedTarget !== cleanEmail && verifiedTarget !== cleanMobile)) {
      res.status(400).json({
        message: "Please complete OTP verification for your email or mobile number before registering.",
      });
      return;
    }

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      res.status(409).json({ message: "This email is already registered. Please login instead." });
      return;
    }

    const existingMobile = await User.findOne({ mobile: cleanMobile });
    if (existingMobile) {
      res.status(409).json({ message: "This mobile number is already registered. Please login instead." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      mobile: cleanMobile,
      password: hashedPassword,
      city: city.trim(),
      state: state.trim(),
      role: "student",
    });

    // Clean up OTP records
    await Otp.deleteMany({ target: { $in: [cleanEmail, cleanMobile] } });

    await notifyAllAdmins(
      "New Student Signup",
      `${user.name} (${user.mobile}) from ${user.city}, ${user.state} just signed up. Review and tag them as a Coaching Student if they're yours.`,
      "system",
      { targetScreen: "adminStudentDetail" }
    );

    const token = signToken(String(user._id), user.role);
    res.status(201).json({ user: toPublicUser(user), token });
  } catch (error) {
    res.status(500).json({ message: "Failed to sign up", error });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, mobile, identifier, password } = req.body as {
      email?: string;
      mobile?: string;
      identifier?: string;
      password?: string;
    };

    const inputIdentifier = (identifier || email || mobile || "").trim();

    if (!inputIdentifier || !password) {
      res.status(400).json({ message: "Email/Mobile number and password are required" });
      return;
    }

    const user = await User.findOne({
      $or: [
        { email: inputIdentifier.toLowerCase() },
        { mobile: inputIdentifier },
      ],
    });

    if (!user) {
      res.status(401).json({ message: "Invalid email/mobile or password" });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      res.status(401).json({ message: "Invalid email/mobile or password" });
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

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, newPassword, confirmPassword } = req.body as {
      email?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (!email || !isValidEmail(email)) {
      res.status(400).json({ message: "Enter a valid email address" });
      return;
    }
    if (!newPassword || !confirmPassword) {
      res.status(400).json({ message: "New password and confirm password are required" });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ message: "New password and confirm password do not match" });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      res.status(400).json({
        message:
          "Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number",
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(404).json({ message: "No account found with this email address" });
      return;
    }

    if (user.role === "admin") {
      res.status(403).json({
        message: "Password reset is not available for admin accounts here. Please contact support.",
      });
      return;
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.activeSessionId = null as any;
    user.activeSessionAt = null as any;
    await user.save();

    res.status(200).json({ message: "Password updated successfully. Please login with your new password." });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset password", error });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (!currentPassword) {
      res.status(400).json({ message: "Current password is required" });
      return;
    }
    if (!newPassword || !confirmPassword) {
      res.status(400).json({ message: "New password and confirm password are required" });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ message: "New password and confirm password do not match" });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      res.status(400).json({
        message:
          "Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number",
      });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const currentMatches = await bcrypt.compare(currentPassword, user.password);
    if (!currentMatches) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to change password", error });
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
