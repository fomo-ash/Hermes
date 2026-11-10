import { ConversationType } from "@prisma/client";
import { AppError } from "../../../common/errors/app-error";
import { ConversationRepository } from "./conversation.repository";
import { getCanonicalDmKey } from "./conversation.utils";
import { withSpan } from "../../../observability/index";
import { getWorkspaceWithMembership } from "../../workspace/workspace.service";
import { verifyWorkspaceMembers } from "../../members/members.service";

export class ConversationService {
  constructor(private repository: ConversationRepository) {}

  // Formats conversation response with otherMember details for DMs
  private formatConversation(conversation: any, currentUserId: string) {
    let otherMember = null;

    if (conversation.type === ConversationType.DIRECT) {
      const other = conversation.members.find(
        (m: any) => m.userId !== currentUserId,
      );
      otherMember = other ? other.user : null;
    }

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
      otherMember,
      lastMessage,
    };
  }

  // Get existing DM or create one using the canonical unique key
  async getOrCreateDirectMessage(
    workspaceSlug: string,
    currentUserId: string,
    recipientUserId: string,
  ) {
    return withSpan("conversation.getOrCreateDirectMessage", async () => {
      // Prevent messaging oneself
      if (currentUserId === recipientUserId) {
        throw new AppError(400, "CANNOT_DM_SELF");
      }

      // Verify workspace exists and current user is an active member
      const { workspace } = await getWorkspaceWithMembership(
        workspaceSlug,
        currentUserId,
      );

      // Verify recipient is also an active member of this workspace
      const isRecipientMember = await verifyWorkspaceMembers(workspace.id, [
        recipientUserId,
      ]);
      if (!isRecipientMember) {
        throw new AppError(403, "MEMBERS_NOT_IN_WORKSPACE");
      }

      // Calculate deterministic canonical DM key: "wsId:minUser:maxUser"
      const canonicalDmKey = getCanonicalDmKey(
        workspace.id,
        currentUserId,
        recipientUserId,
      );

      // Check if conversation already exists
      const existingConversation =
        await this.repository.findByCanonicalKey(canonicalDmKey);

      if (existingConversation) {
        return {
          conversation: this.formatConversation(
            existingConversation,
            currentUserId,
          ),
          isNew: false,
        };
      }

      // Atomically create conversation and member records
      const newConversation =
        await this.repository.createDirectConversation(
          workspace.id,
          canonicalDmKey,
          currentUserId,
          recipientUserId,
        );

      return {
        conversation: this.formatConversation(
          newConversation,
          currentUserId,
        ),
        isNew: true,
      };
    });
  }

  // List all conversations for the user in a workspace
  async listUserConversations(
    workspaceSlug: string,
    currentUserId: string,
    type?: ConversationType,
  ) {
    return withSpan("conversation.listUserConversations", async () => {
      // Verify workspace exists and user is a member
      const { workspace } = await getWorkspaceWithMembership(
        workspaceSlug,
        currentUserId,
      );

      const conversations = await this.repository.findUserConversations(
        workspace.id,
        currentUserId,
        type,
      );

      return conversations.map((conv) =>
        this.formatConversation(conv, currentUserId),
      );
    });
  }

  // Get single conversation details by ID
  async getConversationById(
    workspaceSlug: string,
    currentUserId: string,
    conversationId: string,
  ) {
    return withSpan("conversation.getConversationById", async () => {
      // Verify workspace exists and user is a member
      const { workspace } = await getWorkspaceWithMembership(
        workspaceSlug,
        currentUserId,
      );

      const conversation = await this.repository.findById(
        conversationId,
        workspace.id,
      );
      if (!conversation) {
        throw new AppError(404, "CONVERSATION_NOT_FOUND");
      }

      const isMember = conversation.members.some(
        (m: any) => m.userId === currentUserId,
      );
      if (!isMember) {
        throw new AppError(403, "NOT_CONVERSATION_MEMBER");
      }

      return this.formatConversation(conversation, currentUserId);
    });
  }
}
