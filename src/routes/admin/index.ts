import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth.middleware";
import dashboardRoutes from "./dashboard.routes";
import categoryRoutes from "./category.routes";
import seriesRoutes from "./series.routes";
import testRoutes from "./test.routes";
import questionRoutes from "./question.routes";
import studentRoutes from "./student.routes";
import uploadRoutes from "./upload.routes";

const router = Router();

router.use(requireAuth, requireAdmin);

router.use("/dashboard", dashboardRoutes);
router.use("/categories", categoryRoutes);
router.use("/series", seriesRoutes);
router.use("/tests", testRoutes);
router.use("/questions", questionRoutes);
router.use("/students", studentRoutes);
router.use("/upload", uploadRoutes);

export default router;
