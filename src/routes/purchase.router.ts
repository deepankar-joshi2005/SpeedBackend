import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware";
import {
  buySeries,
  createOrder,
  verifyPayment,
  getMyPurchases,
  getRevenueSummary,
} from "../controllers/purchase.controller";

const router = Router();

router.post("/create-order", requireAuth, createOrder);
router.post("/verify-payment", requireAuth, verifyPayment);
router.post("/buy", requireAuth, buySeries);
router.get("/my-purchases", requireAuth, getMyPurchases);
router.get("/revenue-summary", requireAuth, requireAdmin, getRevenueSummary);

export default router;
