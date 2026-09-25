import { Router } from "express";
import { listEbooksForStudent, markEbookViewed } from "../controllers/ebook.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listEbooksForStudent);
router.patch("/:id/view", requireAuth, markEbookViewed);

export default router;
