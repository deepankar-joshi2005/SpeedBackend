import { Router } from "express";
import {
  getAdminBanners,
  createAdminBanner,
  updateAdminBanner,
  deleteAdminBanner,
} from "../../controllers/admin/adminBanner.controller";

const router = Router();

router.get("/", getAdminBanners);
router.post("/", createAdminBanner);
router.put("/:id", updateAdminBanner);
router.delete("/:id", deleteAdminBanner);

export default router;
