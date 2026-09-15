import { Router } from "express";
import { getAllTestPapers, createTestPaper } from "../controllers/testPaper.controller";

const router = Router();

router.get("/", getAllTestPapers);
router.post("/", createTestPaper);

export default router;
