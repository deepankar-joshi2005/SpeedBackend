import { Router } from "express";
import {
  getAdminUpcomingMocks,
  getAvailableTests,
  addUpcomingMock,
  deleteUpcomingMock,
} from "../../controllers/admin/adminUpcomingMock.controller";

const router = Router();

router.get("/", getAdminUpcomingMocks);
router.get("/available-tests", getAvailableTests);
router.post("/", addUpcomingMock);
router.delete("/:id", deleteUpcomingMock);

export default router;
