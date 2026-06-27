import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../common/utils/async-handler";
import  { AppError } from "../../common/errors/app-error";
import { ErrorCode } from "../../common/errors/error-codes";
import { successResponse, errorResponse } from "../../common/responses/api-response";

import { requireAuth, AuthRequest } from "../../middleware/auth.middleware";
import { rateLimit } from "../../middleware/ratelimiter.middleware";
import { success } from "zod";

const prisma = new PrismaClient();
const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Restrict auth attempts: Burst of 20 requests, refilling at 1 token every second (allows rapid testing during dev)
const authLimiter = rateLimit({ capacity: 20, refillRate: 1 }, "Too many login attempts. Please try again later.");

// Redirect client browser directly to Google Authorization screen

router.get(
  "/google",
  authLimiter,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  authLimiter,
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}/login`,
    session: false,
  }),
  (req, res) => {
    const user = req.user as any;

    // Generate secure internal session JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );

    // Seal token inside a highly secure HTTP-only Cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching token expiry
    });

    // Redirect to onboarding if not onboarded, otherwise to dashboard
    if (!user.onboarded) {
      res.redirect(`${FRONTEND_URL}/onboarding`);
    } else {
      res.redirect(`${FRONTEND_URL}/dashboard`);
    }
  },
);

// 3. Current Authenticated Profile Context Lookup Route
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: { id: true, name: true, email: true, imageUrl: true, onboarded: true },
    });

    if (!user) {
      throw new AppError(404, ErrorCode.USER_NOT_FOUND);
    }

    res.status(200).json(successResponse({ user }));
  }),
);

// Logout Endpoint
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    res.clearCookie("token");
    res.status(200).json(successResponse({ loggedOut: true }));
  }),
);

export default router