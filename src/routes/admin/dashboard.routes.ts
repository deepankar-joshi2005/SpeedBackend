import { Router } from "express";
import { getAdminDashboard } from "../../controllers/admin/dashboard.controller";

const router = Router();

router.get("/", getAdminDashboard);

export default router;
