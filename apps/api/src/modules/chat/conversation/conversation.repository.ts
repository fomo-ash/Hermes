import { ConversationType } from "@prisma/client";
import prisma from "../../../lib/prisma";

export class ConversationRepository {
  /**
   * Find workspace by unique slug
   */
  async findWorkspaceBySlug(slug: string) {
    return prisma.workspace.findUnique({
      where: { slug },
    });
  }

  /**
   * Verify whether a user is an active member of a workspace
   */
  async findWorkspaceMembership(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });
  }

  /**
   * Check if both users belong to the workspace
   */
  async verifyWorkspaceMembers(workspaceId: string, userIds: string[]) {
    const count = await prisma.workspaceMember.count({
      where: {
        workspaceId,
        userId: { in: userIds },
      },
    });
    return count === userIds.length;
  }

  /**
   * Find a Direct Message conversation by its deterministic canonical key
   */
  async findByCanonicalKey(canonicalDmKey: string) {
    return prisma.conversation.findUnique({
      where: { canonicalDmKey },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { sequence: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            sequence: true,
            createdAt: true,
            senderId: true,
            type: true,
          },
        },
      },
    });
  }

  /**
   * Atomically create a new 1:1 Direct Message conversation with both members
   */
  async createDirectConversation(
    workspaceId: string,
    canonicalDmKey: string,
    currentUserId: string,
    recipientUserId: string,
  ) {
    return prisma.conversation.create({
      data: {
        workspaceId,
        type: ConversationType.DIRECT,
        canonicalDmKey,
        createdById: currentUserId,
        members: {
          create: [
            { userId: currentUserId, role: "MEMBER" },
            { userId: recipientUserId, role: "MEMBER" },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        },
        messages: {
          take: 1,
        },
      },
    });
  }

  /**
   * List all conversations in a workspace that the user is a member of
   */
  async findUserConversations(
    workspaceId: string,
    userId: string,
    type?: ConversationType,
  ) {
    return prisma.conversation.findMany({
      where: {
        workspaceId,
        ...(type ? { type } : {}),
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { sequence: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            sequence: true,
            createdAt: true,
            senderId: true,
            type: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  /**
   * Find a specific conversation by ID within a workspace
   */
  async findById(conversationId: string, workspaceId: string) {
    return prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });
  }
}

