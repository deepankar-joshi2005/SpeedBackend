import { Router } from "express";
import { listStudents, getStudentDetail } from "../../controllers/admin/student.controller";

const router = Router();

router.get("/", listStudents);
router.get("/:id", getStudentDetail);

export default router;
