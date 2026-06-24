import { Router } from "express";
import { authController } from "./auth.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  authController.getCurrentUser.bind(authController),
);

export default router;
