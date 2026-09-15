import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "../models/user.model";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export interface AuthRequest extends Request {
  userId?: string;
  role?: Role;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: "Authentication token is missing" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role?: Role };
    req.userId = payload.userId;
    req.role = payload.role ?? "student";
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
};
