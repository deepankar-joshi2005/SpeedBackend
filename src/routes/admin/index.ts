import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth.middleware";
import dashboardRoutes from "./dashboard.routes";
import categoryRoutes from "./category.routes";
import seriesRoutes from "./series.routes";
import testRoutes from "./test.routes";
import questionRoutes from "./question.routes";
import studentRoutes from "./student.routes";
import uploadRoutes from "./upload.routes";
import bannerRoutes from "./banner.routes";
import teacherRoutes from "./teacher.routes";
import successStoryRoutes from "./successStory.routes";
import pyqRoutes from "./pyq.routes";
import ebookRoutes from "./ebook.routes";

const router = Router();

router.use(requireAuth, requireAdmin);

router.use("/dashboard", dashboardRoutes);
router.use("/categories", categoryRoutes);
router.use("/series", seriesRoutes);
router.use("/tests", testRoutes);
router.use("/questions", questionRoutes);
router.use("/students", studentRoutes);
router.use("/upload", uploadRoutes);
router.use("/banners", bannerRoutes);
router.use("/teacher-info", teacherRoutes);
router.use("/success-stories", successStoryRoutes);
router.use("/pyq", pyqRoutes);
router.use("/ebooks", ebookRoutes);

export default router;
