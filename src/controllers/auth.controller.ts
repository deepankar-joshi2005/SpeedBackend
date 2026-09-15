import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User, { Role, Language } from "../models/user.model";
import { isValidEmail, isValidMobile, isStrongPassword } from "../utils/validators";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const TOKEN_EXPIRY = "7d";

const signToken = (userId: string, role: Role): string =>
  jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

const toPublicUser = (user: {
  _id: unknown;
  name: string;
  email: string;
  mobile: string;
  role: Role;
  preferredLanguage?: Language;
}) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  role: user.role,
  preferredLanguage: user.preferredLanguage ?? "English",
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, mobile, password } = req.body as {
      name?: string;
      email?: string;
      mobile?: string;
      password?: string;
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
      role: "student",
    });

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

    const token = signToken(String(user._id), user.role);
    res.status(200).json({ user: toPublicUser(user), token });
  } catch (error) {
    res.status(500).json({ message: "Failed to login", error });
  }
};
