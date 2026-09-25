import path from "path";
import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db";
import testPaperRoutes from "./routes/testPaper.routes";
import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import testsRoutes from "./routes/tests.routes";
import attemptsRoutes from "./routes/attempts.routes";
import performanceRoutes from "./routes/performance.routes";
import profileRoutes from "./routes/profile.routes";
import notificationsRoutes from "./routes/notifications.routes";
import supportRoutes from "./routes/support.routes";
import purchaseRoutes from "./routes/purchase.router";
import contentPurchaseRoutes from "./routes/contentPurchase.routes";
import pyqRoutes from "./routes/pyq.routes";
import ebookRoutes from "./routes/ebook.routes";
import sectionalRoutes from "./routes/sectional.routes";
import socialMediaRoutes from "./routes/socialMedia.routes";
import uploadRoutes from "./routes/upload.routes";
import adminRoutes from "./routes/admin";
import { verifySignedPath } from "./utils/signedUrl";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// PYQ and E-Book PDFs are paid content — everything else under /uploads
// (banners, category icons, etc.) stays publicly served as before, but these
// two subfolders require a short-lived signature minted only for entitled
// students (see utils/signedUrl.ts + student pyq/ebook controllers).
const PROTECTED_UPLOAD_PREFIXES = ["/pyq/", "/ebooks/"];
app.use(
  "/uploads",
  (req: Request, res: Response, next: NextFunction) => {
    const isProtected = PROTECTED_UPLOAD_PREFIXES.some((prefix) => req.path.startsWith(prefix));
    if (!isProtected) {
      next();
      return;
    }
    const { exp, sig } = req.query as { exp?: string; sig?: string };
    const canonicalPath = `/uploads${req.path}`;
    if (!verifySignedPath(canonicalPath, exp, sig)) {
      res.status(403).json({ message: "This link has expired. Please reopen it from the app." });
      return;
    }
    next();
  },
  express.static(path.join(__dirname, "../uploads"))
);

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", message: "Backend is running" });
});

app.use("/api/test-papers", testPaperRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tests", testsRoutes);
app.use("/api/attempts", attemptsRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/content-purchases", contentPurchaseRoutes);
app.use("/api/pyq", pyqRoutes);
app.use("/api/ebooks", ebookRoutes);
app.use("/api/sectional", sectionalRoutes);
app.use("/api/social-media", socialMediaRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
