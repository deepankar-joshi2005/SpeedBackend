import { Router } from "express";
import { uploadFile } from "../../controllers/admin/upload.controller";
import { uploadImage } from "../../middleware/upload.middleware";

const router = Router();

router.post("/", uploadImage.single("file"), uploadFile);

export default router;
