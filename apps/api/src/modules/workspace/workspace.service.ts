import { Prisma, Role } from "@prisma/client";
import crypto from "crypto";
import prisma from "../../lib/prisma";
import { AppError } from "../../common/errors/app-error";
import { ErrorCode } from "../../common/errors/error-codes";

function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

async function generateUniqueSlug(
  tx: Prisma.TransactionClient,
  name: string,
): Promise<string> {
  const baseSlug = generateSlug(name);

  let slug = baseSlug;
  let count = 1;

  while (true) {
    const existing = await tx.workspace.findUnique({
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${count++}`;
  }
}

export async function createWorkspaceForUser(
  userId: string,
  workspaceName: string,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? (prisma as unknown as Prisma.TransactionClient);

  const slug = await generateUniqueSlug(db, workspaceName);

  const workspace = await db.workspace.create({
    data: {
      name: workspaceName.trim(),
      slug,
      inviteCode: crypto.randomUUID().slice(0, 8).toUpperCase(),
    },
  });

  await db.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId,
      role: Role.OWNER,
    },
  });

  return workspace;
}

// Find workspace by slug and verify user membership
export async function getWorkspaceWithMembership(slug: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
  });

  if (!workspace) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND");
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId: workspace.id,
      },
    },
  });

  if (!membership) {
    throw new AppError(403, ErrorCode.FORBIDDEN);
  }

  return { workspace, membership };
}

// Find workspace by slug
export async function getWorkspaceBySlug(slug: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
  });

  if (!workspace) {
    throw new AppError(404, "WORKSPACE_NOT_FOUND");
  }

  return workspace;
}
