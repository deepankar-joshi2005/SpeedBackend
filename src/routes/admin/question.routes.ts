import { Router } from "express";
import {
  listBank,
  getStats,
  getQuestion,
  getByTest,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  addToTest,
  importQuestions,
} from "../../controllers/admin/question.controller";
import { uploadImport } from "../../middleware/upload.middleware";

const router = Router();

router.get("/", listBank);
router.get("/stats", getStats);
router.get("/by-test/:testId", getByTest);
router.post("/by-test/:testId/import", uploadImport.single("file"), importQuestions);
router.post("/", createQuestion);
router.get("/:id", getQuestion);
router.put("/:id", updateQuestion);
router.delete("/:id", deleteQuestion);
router.post("/:id/add-to-test", addToTest);

export default router;
