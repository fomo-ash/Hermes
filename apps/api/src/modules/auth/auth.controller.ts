import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../lib/prisma";
import { AuthRequest } from "../../middleware/auth.middleware";
import { AppError } from "../../common/errors/app-error";
import { ErrorCode } from "../../common/errors/error-codes";
import { successResponse } from "../../common/responses/api-response";

export const handleGoogleCallback = (req: Request, res: Response) => {
  const user = req.user as any;

  // Generate secure internal session JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

  // Seal token inside a highly secure HTTP-only Cookie
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching token expiry
  });

  const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

  // Redirect to onboarding if not onboarded, otherwise to dashboard
  if (!user.onboarded) {
    res.redirect(`${FRONTEND_URL}/onboarding`);
  } else {
    res.redirect(`${FRONTEND_URL}/dashboard`);
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user?.id },
    select: { id: true, name: true, email: true, imageUrl: true, onboarded: true },
  });

  if (!user) {
    throw new AppError(404, ErrorCode.USER_NOT_FOUND);
  }

  res.status(200).json(successResponse({ user }));
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie("token");
  res.clearCookie("_csrf");
  res.status(200).json(successResponse({ loggedOut: true }));
};
