import crypto from "crypto";
import { Role } from "@prisma/client";
import { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error";
import { ErrorCode } from "../../common/errors/error-codes";
import { successResponse } from "../../common/responses/api-response";
import prisma from "../../lib/prisma";
import { createWorkspaceForUser, getWorkspaceWithMembership } from "./workspace.service";

export const createWorkspace = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const workspace = await createWorkspaceForUser(userId, req.body.name);

  return res.status(201).json(successResponse(workspace));
};

export const getMyWorkspaces = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  const workspaces = memberships.map(({ workspace, role }) => ({
    ...workspace,
    myRole: role,
  }));

  return res.status(200).json(successResponse(workspaces));
};

export const joinWorkspace = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const workspace = await prisma.workspace.findUnique({
    where: { inviteCode: req.body.inviteCode },
  });

  if (!workspace) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND");
  }

  const existingMembership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId: workspace.id,
      },
    },
  });

  if (existingMembership) {
    throw new AppError(409, "ALREADY_MEMBER");
  }

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId,
      role: Role.MEMBER,
    },
  });

  return res.status(200).json(successResponse(workspace));
};

export const getWorkspace = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const slug = Array.isArray(req.params.slug)
    ? req.params.slug[0]
    : req.params.slug;
  const { workspace } = await getWorkspaceWithMembership(slug, userId);

  return res.status(200).json(successResponse(workspace));
};



export const updateWorkspace = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const slug = Array.isArray(req.params.slug)
    ? req.params.slug[0]
    : req.params.slug;
  const { workspace, membership } = await getWorkspaceWithMembership(
    slug,
    userId,
  );

  if (membership.role !== Role.OWNER && membership.role !== Role.ADMIN) {
    throw new AppError(403, ErrorCode.FORBIDDEN);
  }

  const updatedWorkspace = await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      ...(req.body.name !== undefined ? { name: req.body.name } : {}),
      ...(req.body.iconUrl !== undefined ? { iconUrl: req.body.iconUrl } : {}),
    },
  });

  return res.status(200).json(successResponse(updatedWorkspace));
};

export const regenerateInviteCode = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const slug = Array.isArray(req.params.slug)
    ? req.params.slug[0]
    : req.params.slug;
  const { workspace, membership } = await getWorkspaceWithMembership(
    slug,
    userId,
  );

  if (membership.role !== Role.OWNER && membership.role !== Role.ADMIN) {
    throw new AppError(403, ErrorCode.FORBIDDEN);
  }

  const updatedWorkspace = await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      inviteCode: crypto.randomUUID().slice(0, 8).toUpperCase(),
    },
  });

  return res.status(200).json(successResponse(updatedWorkspace));
};
