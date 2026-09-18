import { Router } from "express";
import {
  listStudents,
  getStudentDetail,
  setCoachingTag,
  deleteStudent,
} from "../../controllers/admin/student.controller";

const router = Router();

router.get("/", listStudents);
router.get("/:id", getStudentDetail);
router.patch("/:id/coaching-tag", setCoachingTag);
router.delete("/:id", deleteStudent);

export default router;
