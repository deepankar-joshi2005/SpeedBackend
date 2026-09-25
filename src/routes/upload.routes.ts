import { Router } from "express";
import { uploadFile } from "../controllers/upload.controller";
import { uploadImage } from "../middleware/upload.middleware";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/", requireAuth, uploadImage.single("file"), uploadFile);

export default router;
