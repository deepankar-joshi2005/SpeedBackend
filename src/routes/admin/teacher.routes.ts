import { Router } from "express";
import {
  getAdminTeacherInfo,
  updateAdminTeacherInfo,
} from "../../controllers/admin/adminTeacher.controller";

const router = Router();

router.get("/", getAdminTeacherInfo);
router.put("/", updateAdminTeacherInfo);

export default router;
