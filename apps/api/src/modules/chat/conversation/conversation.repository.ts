import { ConversationType } from "@prisma/client";
import prisma from "../../../lib/prisma";

export class ConversationRepository {
  // Find DM conversation by canonical unique key
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

  // Atomically create conversation and member records
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

  // List all conversations for a user in a workspace
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

  // Find a specific conversation by ID in a workspace
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
