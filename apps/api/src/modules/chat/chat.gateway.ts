import { Server } from "socket.io";
import prisma from "../../lib/prisma";

export function initializeChat(io: Server) {
  io.on("connection", (socket) => {
    socket.on("chat:typing", async (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const { conversationId, isTyping } = payload as Record<string, unknown>;
      if (typeof conversationId !== "string" || typeof isTyping !== "boolean") return;

      try {
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            members: { some: { userId: socket.data.userId, leftAt: null } },
            workspace: { memberships: { some: { userId: socket.data.userId } } },
          },
          select: { workspaceId: true, members: { where: { leftAt: null }, select: { userId: true } } },
        });
        if (!conversation) return;

        const workspaceMembers = await prisma.workspaceMember.findMany({
          where: { workspaceId: conversation.workspaceId, userId: { in: conversation.members.map((member) => member.userId) } },
          select: { userId: true },
        });
        const eligibleIds = new Set(workspaceMembers.map((member) => member.userId));

        for (const member of conversation.members) {
          if (member.userId !== socket.data.userId && eligibleIds.has(member.userId)) {
            io.to(`user:${member.userId}`).emit("chat:typing", {
              conversationId,
              userId: socket.data.userId,
              isTyping,
            });
          }
        }
      } catch {
        // Typing is transient; message delivery does not depend on it.
      }
    });
  });
}
