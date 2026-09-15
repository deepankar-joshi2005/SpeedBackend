import path from "path";
import express, { Application, Request, Response } from "express";
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
import adminRoutes from "./routes/admin";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

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
app.use("/api/admin", adminRoutes);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
