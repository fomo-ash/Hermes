import { PrismaClient, Prisma, Role } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

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
