import { ConversationMemberRole, ConversationType, Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma";
import { AppError } from "../../../common/errors/app-error";
import { getWorkspaceWithMembership } from "../../workspace/workspace.service";

const groupInclude = {
  members: {
    include: { user: { select: { id: true, name: true, email: true, imageUrl: true } } },
  },
} satisfies Prisma.ConversationInclude;
type GroupRecord = Prisma.ConversationGetPayload<{ include: typeof groupInclude }>;

function formatGroup(group: GroupRecord, userId: string) {
  const activeMembers = group.members.filter((member) => member.leftAt === null);
  const me = activeMembers.find((member) => member.userId === userId);
  return {
    id: group.id,
    workspaceId: group.workspaceId,
    type: group.type,
    title: group.title,
    description: group.description,
    iconUrl: group.iconUrl,
    lastSequence: group.lastSequence,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    members: activeMembers,
    memberCount: activeMembers.length,
    myRole: me?.role ?? null,
    lastReadSequence: me?.lastReadSequence ?? 0,
    unreadCount: Math.max(0, group.lastSequence - (me?.lastReadSequence ?? 0)),
  };
}

async function requireGroup(tx: Prisma.TransactionClient, workspaceId: string, groupId: string, userId: string) {
  const group = await tx.conversation.findFirst({
    where: { id: groupId, workspaceId, type: ConversationType.GROUP },
    include: groupInclude,
  });
  if (!group) throw new AppError(404, "GROUP_NOT_FOUND");
  const actor = group.members.find((member) => member.userId === userId && member.leftAt === null);
  if (!actor) throw new AppError(403, "NOT_CONVERSATION_MEMBER");
  return { group, actor };
}

async function verifyInvites(tx: Prisma.TransactionClient, workspaceId: string, userIds: string[]) {
  const count = await tx.workspaceMember.count({ where: { workspaceId, userId: { in: userIds } } });
  if (count !== userIds.length) throw new AppError(400, "MEMBERS_NOT_IN_WORKSPACE");
}

export async function createGroup(workspaceSlug: string, creatorId: string, title: string, description: string | undefined, invitedIds: string[]) {
  const { workspace } = await getWorkspaceWithMembership(workspaceSlug, creatorId);
  const userIds = [...new Set([creatorId, ...invitedIds])];
  if (userIds.length < 2) throw new AppError(400, "GROUP_REQUIRES_OTHER_MEMBER");
  return prisma.$transaction(async (tx) => {
    await verifyInvites(tx, workspace.id, userIds);
    const group = await tx.conversation.create({
      data: {
        workspaceId: workspace.id, type: ConversationType.GROUP, title: title.trim(), description: description?.trim(),
        createdById: creatorId,
        members: { create: userIds.map((userId) => ({ userId, role: userId === creatorId ? ConversationMemberRole.OWNER : ConversationMemberRole.MEMBER })) },
      },
      include: groupInclude,
    });
    return formatGroup(group, creatorId);
  });
}

export async function listGroups(workspaceSlug: string, userId: string) {
  const { workspace } = await getWorkspaceWithMembership(workspaceSlug, userId);
  const groups = await prisma.conversation.findMany({
    where: { workspaceId: workspace.id, type: ConversationType.GROUP, members: { some: { userId, leftAt: null } } },
    include: groupInclude,
    orderBy: { updatedAt: "desc" },
  });
  return groups.map((group) => formatGroup(group, userId));
}

export async function getGroup(workspaceSlug: string, userId: string, groupId: string) {
  const { workspace } = await getWorkspaceWithMembership(workspaceSlug, userId);
  const { group } = await requireGroup(prisma, workspace.id, groupId, userId);
  return formatGroup(group, userId);
}

export async function updateGroup(workspaceSlug: string, userId: string, groupId: string, changes: { title?: string; description?: string | null; iconUrl?: string | null }) {
  const { workspace } = await getWorkspaceWithMembership(workspaceSlug, userId);
  return prisma.$transaction(async (tx) => {
    const { actor } = await requireGroup(tx, workspace.id, groupId, userId);
    if (actor.role === ConversationMemberRole.MEMBER) throw new AppError(403, "GROUP_ADMIN_REQUIRED");
    const group = await tx.conversation.update({ where: { id: groupId }, data: {
      ...changes,
      ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
      ...(typeof changes.description === "string" ? { description: changes.description.trim() } : {}),
    }, include: groupInclude });
    return formatGroup(group, userId);
  });
}

export async function addGroupMembers(workspaceSlug: string, userId: string, groupId: string, invitedIds: string[]) {
  const { workspace } = await getWorkspaceWithMembership(workspaceSlug, userId);
  const userIds = [...new Set(invitedIds)];
  return prisma.$transaction(async (tx) => {
    const { group, actor } = await requireGroup(tx, workspace.id, groupId, userId);
    if (actor.role === ConversationMemberRole.MEMBER) throw new AppError(403, "GROUP_ADMIN_REQUIRED");
    await verifyInvites(tx, workspace.id, userIds);
    for (const invitedId of userIds) {
      const previous = group.members.find((member) => member.userId === invitedId);
      if (previous?.leftAt === null) throw new AppError(409, "ALREADY_GROUP_MEMBER");
      if (previous) {
        await tx.conversationMember.update({ where: { id: previous.id }, data: { leftAt: null, joinedAt: new Date(), lastReadSequence: group.lastSequence, role: ConversationMemberRole.MEMBER } });
      } else {
        await tx.conversationMember.create({ data: { conversationId: groupId, userId: invitedId, lastReadSequence: group.lastSequence } });
      }
    }
    const updated = await tx.conversation.findUniqueOrThrow({ where: { id: groupId }, include: groupInclude });
    return formatGroup(updated, userId);
  });
}

export async function removeGroupMember(workspaceSlug: string, userId: string, groupId: string, targetId: string) {
  const { workspace } = await getWorkspaceWithMembership(workspaceSlug, userId);
  return prisma.$transaction(async (tx) => {
    const { group, actor } = await requireGroup(tx, workspace.id, groupId, userId);
    const target = group.members.find((member) => member.userId === targetId && member.leftAt === null);
    if (!target) throw new AppError(404, "GROUP_MEMBER_NOT_FOUND");
    if (target.role === ConversationMemberRole.OWNER) throw new AppError(400, "TRANSFER_OWNERSHIP_FIRST");
    if (userId !== targetId && (actor.role === ConversationMemberRole.MEMBER || (actor.role === ConversationMemberRole.ADMIN && target.role !== ConversationMemberRole.MEMBER))) {
      throw new AppError(403, "GROUP_ADMIN_REQUIRED");
    }
    await tx.conversationMember.update({ where: { id: target.id }, data: { leftAt: new Date() } });
    return { conversationId: groupId, userId: targetId };
  });
}

export async function changeGroupRole(workspaceSlug: string, userId: string, groupId: string, targetId: string, role: ConversationMemberRole) {
  const { workspace } = await getWorkspaceWithMembership(workspaceSlug, userId);
  return prisma.$transaction(async (tx) => {
    const { group, actor } = await requireGroup(tx, workspace.id, groupId, userId);
    if (actor.role !== ConversationMemberRole.OWNER) throw new AppError(403, "GROUP_OWNER_REQUIRED");
    const target = group.members.find((member) => member.userId === targetId && member.leftAt === null);
    if (!target) throw new AppError(404, "GROUP_MEMBER_NOT_FOUND");
    if (role === ConversationMemberRole.OWNER) {
      if (targetId !== userId) {
        await tx.conversationMember.update({ where: { id: actor.id }, data: { role: ConversationMemberRole.ADMIN } });
        await tx.conversationMember.update({ where: { id: target.id }, data: { role: ConversationMemberRole.OWNER } });
      }
    } else {
      if (target.role === ConversationMemberRole.OWNER) throw new AppError(400, "TRANSFER_OWNERSHIP_FIRST");
      await tx.conversationMember.update({ where: { id: target.id }, data: { role } });
    }
    const updated = await tx.conversation.findUniqueOrThrow({ where: { id: groupId }, include: groupInclude });
    return formatGroup(updated, userId);
  });
}

export async function deleteGroup(workspaceSlug: string, userId: string, groupId: string) {
  const { workspace } = await getWorkspaceWithMembership(workspaceSlug, userId);
  return prisma.$transaction(async (tx) => {
    const { actor } = await requireGroup(tx, workspace.id, groupId, userId);
    if (actor.role !== ConversationMemberRole.OWNER) throw new AppError(403, "GROUP_OWNER_REQUIRED");
    await tx.conversation.delete({ where: { id: groupId } });
    return { id: groupId };
  });
}
