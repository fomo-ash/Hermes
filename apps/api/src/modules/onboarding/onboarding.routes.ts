import { Router } from "express";
import { PrismaClient } from "@prisma/client";

import { asyncHandler } from "../../common/utils/async-handler";
import { successResponse } from "../../common/responses/api-response";

import { AuthRequest, requireAuth } from "../../middleware/auth.middleware";

import { rateLimit } from "../../middleware/ratelimiter.middleware";

import { createWorkspaceForUser } from "../workspace/workspace.service";

const router = Router();
const prisma = new PrismaClient();

const checkUsernameLimiter = rateLimit(
  { capacity: 5, refillRate: 1 },
  "Too many username checks. Please slow down.",
);

router.get(
  "/check-username",
  checkUsernameLimiter,
  asyncHandler(async (req, res) => {
    const { username } = req.query;

    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({
        message: "Username is required",
      });
    }

    const sanitizedUsername = username.trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: {
        username: sanitizedUsername,
      },
    });

    return res.json(
      successResponse({
        available: !existing,
      }),
    );
  }),
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { username, imageUrl, workspaceName } = req.body;

    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({
        message: "Username is required",
      });
    }

    if (
      !workspaceName ||
      typeof workspaceName !== "string" ||
      !workspaceName.trim()
    ) {
      return res.status(400).json({
        message: "Workspace name is required",
      });
    }

    const sanitizedUsername = username.trim().toLowerCase();

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        username: sanitizedUsername,
      },
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({
        message: "Username already taken",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          username: sanitizedUsername,
          imageUrl: imageUrl || undefined,
          onboarded: true,
        },
      });

      const workspace = await createWorkspaceForUser(userId, workspaceName, tx);

      return {
        user,
        workspace,
      };
    });

    return res.status(200).json(
      successResponse({
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          imageUrl: result.user.imageUrl,
        },
        workspace: result.workspace,
        redirectUrl: `/workspace/${result.workspace.slug}`,
      }),
    );
  }),
);

export default router;
