import { Router } from "express";
import {
  listAllTests,
  createTest,
  updateTestConfig,
  getTestDetail,
  getPublishChecklist,
  publishTest,
  deleteTest,
  setSubjectSections,
} from "../../controllers/admin/test.controller";

const router = Router();

router.get("/", listAllTests);
router.post("/", createTest);
router.get("/:id", getTestDetail);
router.get("/:id/checklist", getPublishChecklist);
router.put("/:id", updateTestConfig);
router.put("/:id/subject-sections", setSubjectSections);
router.patch("/:id/publish", publishTest);
router.delete("/:id", deleteTest);

export default router;
