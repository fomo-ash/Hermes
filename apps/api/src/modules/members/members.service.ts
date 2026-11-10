import { Role } from "@prisma/client";
import { AppError } from "../../common/errors/app-error";
import prisma from "../../lib/prisma";
import { getWorkspaceWithMembership } from "../workspace/workspace.service";

// Verify that all userIds are active members of the workspace
export async function verifyWorkspaceMembers(
  workspaceId: string,
  userIds: string[],
): Promise<boolean> {
  const count = await prisma.workspaceMember.count({
    where: {
      workspaceId,
      userId: { in: userIds },
    },
  });
  return count === userIds.length;
}

export async function getWorkspaceMembers(workspaceSlug: string, userId: string) {
  const { workspace } = await getWorkspaceWithMembership(workspaceSlug, userId);

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return members.map(({ user, role, createdAt, id }) => ({
    id,
    userId: user.id,
    name: user.name,
    email: user.email,
    image: user.imageUrl,
    role,
    joinedAt: createdAt,
  }));
}

export async function getMyWorkspaceMembership(workspaceSlug: string, userId: string) {
  const { workspace, membership } = await getWorkspaceWithMembership(workspaceSlug, userId);

  return {
    workspaceId: workspace.id,
    userId: membership.userId,
    role: membership.role,
    joinedAt: membership.createdAt,
  };
}

export async function removeMember(workspaceSlug: string, memberId: string, requesterUserId: string) {
  const { workspace, membership: requesterMembership } = await getWorkspaceWithMembership(
    workspaceSlug,
    requesterUserId,
  );

  // Only Owner can remove members
  if (requesterMembership.role !== Role.OWNER) {
    throw new AppError(403, "ONLY_OWNER_CAN_REMOVE");
  }

  const targetMember = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
  });

  if (!targetMember || targetMember.workspaceId !== workspace.id) {
    throw new AppError(404, "MEMBER_NOT_FOUND");
  }

  // Owner cannot remove themselves
  if (targetMember.userId === requesterUserId) {
    throw new AppError(400, "CANNOT_REMOVE_SELF");
  }

  await prisma.workspaceMember.delete({
    where: { id: memberId },
  });

  return { success: true };
}

export async function leaveWorkspace(workspaceSlug: string, userId: string) {
  const { membership } = await getWorkspaceWithMembership(workspaceSlug, userId);

  // Owners cannot leave the workspace (they must transfer ownership or delete the workspace)
  if (membership.role === Role.OWNER) {
    throw new AppError(400, "OWNER_CANNOT_LEAVE_WORKSPACE");
  }

  await prisma.workspaceMember.delete({
    where: { id: membership.id },
  });

  return { success: true };
}
