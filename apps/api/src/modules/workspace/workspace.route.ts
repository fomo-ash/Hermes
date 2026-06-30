import { Router } from "express";
import { PrismaClient } from "@prisma/client";

import { asyncHandler } from "../../common/utils/async-handler";
import { successResponse } from "../../common/responses/api-response";

import { AuthRequest, requireAuth } from "../../middleware/auth.middleware";

import { createWorkspaceForUser } from "./workspace.service";

const router = Router();
const prisma = new PrismaClient();

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { name } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Workspace name is required",
      });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const workspace = await prisma.$transaction(async (tx) => {
      return createWorkspaceForUser(userId, name, tx);
    });

    return res.status(201).json(
      successResponse({
        workspace,
      }),
    );
  }),
);



export default router;
