import { Router } from "express";
import passport from "passport";
import { asyncHandler } from "../../common/utils/async-handler";
import * as authController from "./auth.controller";
import { rateLimit } from "../../middleware/ratelimiter.middleware";
import { requireAuth } from "../../middleware/auth.middleware";

const router = Router();

const authLimiter = rateLimit({
  capacity: 20,
  refillRate: 1,
  message: "Too many login attempts. Please try again later.",
});

const meLimiter = rateLimit({
  capacity: 60,
  refillRate: 1,
  message: "Too many requests. Please try again later.",
});

router.get(
  "/google",
  authLimiter,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

router.get(
  "/google/callback",
  authLimiter,
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`,
    session: false,
  }),
  authController.handleGoogleCallback
);

router.get("/csrf", (req, res) => {
  const token = (typeof (req as any).csrfToken === "function" ? (req as any).csrfToken() : null) || res.locals._csrf;
  return res.status(200).json({ success: true, data: { csrfToken: token }, error: null });
});

router.get("/me", meLimiter, requireAuth, asyncHandler(authController.getMe));

router.post("/logout", authController.logout);

export default router;