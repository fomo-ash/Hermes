import { AppError } from "../../../common/errors/app-error";
import { withSpan } from "../../../observability/index";
import { getWorkspaceWithMembership } from "../../workspace/workspace.service";
import { verifyWorkspaceMembers } from "../../members/members.service";
import { ConversationRepository } from "../conversation/conversation.repository";
import { getCanonicalDmKey } from "../conversation/conversation.utils";

export class DmService {
  constructor(
    private conversationRepo: ConversationRepository = new ConversationRepository(),
  ) {}

  private formatDmConversation(conversation: any, currentUserId: string) {
    const other = conversation.members?.find(
      (m: any) => m.userId !== currentUserId,
    );
    const lastMessage =
      conversation.messages && conversation.messages.length > 0
        ? conversation.messages[0]
        : null;

    return {
      id: conversation.id,
      workspaceId: conversation.workspaceId,
      type: conversation.type,
      title: conversation.title,
      description: conversation.description,
      iconUrl: conversation.iconUrl,
      canonicalDmKey: conversation.canonicalDmKey,
      lastSequence: conversation.lastSequence,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      members: conversation.members,
      otherMember: other ? other.user : null,
      lastMessage,
    };
  }

  // Get existing DM or atomically create one via deterministic canonicalDmKey
  async getOrCreateDirectMessage(
    workspaceSlug: string,
    currentUserId: string,
    recipientUserId: string,
  ) {
    return withSpan("dm.getOrCreateDirectMessage", async () => {
      if (currentUserId === recipientUserId) {
        throw new AppError(400, "CANNOT_DM_SELF");
      }

      const { workspace } = await getWorkspaceWithMembership(
        workspaceSlug,
        currentUserId,
      );

      const isRecipientMember = await verifyWorkspaceMembers(workspace.id, [
        recipientUserId,
      ]);
      if (!isRecipientMember) {
        throw new AppError(403, "MEMBERS_NOT_IN_WORKSPACE");
      }

      const canonicalDmKey = getCanonicalDmKey(
        workspace.id,
        currentUserId,
        recipientUserId,
      );

      const existing = await this.conversationRepo.findByCanonicalKey(canonicalDmKey);
      if (existing) {
        return {
          conversation: this.formatDmConversation(existing, currentUserId),
          isNew: false,
        };
      }

      let newConversation;
      try {
        newConversation = await this.conversationRepo.createDirectConversation(
          workspace.id,
          canonicalDmKey,
          currentUserId,
          recipientUserId,
        );
      } catch (error: any) {
        if (error?.code === "P2002") {
          const winner = await this.conversationRepo.findByCanonicalKey(canonicalDmKey);
          if (winner) {
            return {
              conversation: this.formatDmConversation(winner, currentUserId),
              isNew: false,
            };
          }
        }
        throw error;
      }

      return {
        conversation: this.formatDmConversation(newConversation, currentUserId),
        isNew: true,
      };
    });
  }
}

export const dmService = new DmService();
