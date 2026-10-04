import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware";
import {
  createOrder,
  verifyPayment,
  getMyPurchases,
  getMyOrders,
  getRevenueSummary,
} from "../controllers/purchase.controller";

const router = Router();

router.post("/create-order", requireAuth, createOrder);
router.post("/verify-payment", requireAuth, verifyPayment);
router.get("/my-purchases", requireAuth, getMyPurchases);
router.get("/my-orders", requireAuth, getMyOrders);
router.get("/revenue-summary", requireAuth, requireAdmin, getRevenueSummary);

export default router;
