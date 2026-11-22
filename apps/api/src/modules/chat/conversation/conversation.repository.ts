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

  async findExistingMessage(senderId: string, clientMessageId: string) {
    return prisma.message.findUnique({
      where: {
        senderId_clientMessageId: {
          senderId,
          clientMessageId,
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
          },
        },
      },
    });
  }

  async createMessageWithSequence(data: {
    conversationId: string;
    senderId: string;
    clientMessageId: string;
    content: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const updatedConv = await tx.conversation.update({
        where: { id: data.conversationId },
        data: {
          lastSequence: { increment: 1 },
        },
        select: {
          lastSequence: true,
        },
      });

      const message = await tx.message.create({
        data: {
          conversationId: data.conversationId,
          senderId: data.senderId,
          clientMessageId: data.clientMessageId,
          content: data.content,
          sequence: updatedConv.lastSequence,
          type: "TEXT",
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              imageUrl: true,
            },
          },
        },
      });

      return message;
    });
  }

  async findMessagesByCursor(params: {
    conversationId: string;
    beforeSequence?: number;
    limit: number;
  }) {
    const take = params.limit + 1;
    const messages = await prisma.message.findMany({
      where: {
        conversationId: params.conversationId,
        deletedAt: null,
        ...(params.beforeSequence !== undefined
          ? { sequence: { lt: params.beforeSequence } }
          : {}),
      },
      orderBy: { sequence: "desc" },
      take,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
          },
        },
      },
    });

    const hasMore = messages.length > params.limit;
    const resultMessages = hasMore ? messages.slice(0, params.limit) : messages;
    const nextCursor =
      hasMore && resultMessages.length > 0
        ? resultMessages[resultMessages.length - 1].sequence
        : null;

    return {
      messages: resultMessages,
      nextCursor,
      hasMore,
    };
  }

  async updateLastReadSequence(
    conversationId: string,
    userId: string,
    sequence: number,
  ) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        conversationId: string;
        userId: string;
        lastReadSequence: number;
      }>
    >`
      UPDATE "ConversationMember"
      SET "lastReadSequence" = GREATEST("lastReadSequence", ${sequence}::integer)
      WHERE "conversationId" = ${conversationId} AND "userId" = ${userId}
      RETURNING id, "conversationId", "userId", "lastReadSequence";
    `;

    return rows[0] ?? null;
  }
}
