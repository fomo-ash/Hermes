import { ConversationType } from "@prisma/client";
import { AppError } from "../../../common/errors/app-error";
import { ConversationRepository } from "./conversation.repository";
import { getCanonicalDmKey } from "./conversation.utils";
import { withSpan } from "../../../observability/index";

export class ConversationService {
  constructor(private repository: ConversationRepository) {}

  /**
   * Format a conversation DTO to include otherMember info for 1:1 DMs
   */
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

  /**
   * Get an existing 1:1 Direct Message or create a new one deterministically
   */
  async getOrCreateDirectMessage(
    workspaceSlug: string,
    currentUserId: string,
    recipientUserId: string,
  ) {
    return withSpan("conversation.getOrCreateDirectMessage", async () => {
      // 1. Prevent messaging oneself
      if (currentUserId === recipientUserId) {
        throw new AppError(400, "CANNOT_DM_SELF");
      }

      // 2. Validate workspace exists
      const workspace = await this.repository.findWorkspaceBySlug(workspaceSlug);
      if (!workspace) {
        throw new AppError(404, "WORKSPACE_NOT_FOUND");
      }

      // 3. Verify both users are active members of this workspace
      const areMembers = await this.repository.verifyWorkspaceMembers(
        workspace.id,
        [currentUserId, recipientUserId],
      );
      if (!areMembers) {
        throw new AppError(403, "MEMBERS_NOT_IN_WORKSPACE");
      }

      // 4. Calculate deterministic canonical DM key
      const canonicalDmKey = getCanonicalDmKey(
        workspace.id,
        currentUserId,
        recipientUserId,
      );

      // 5. Check if direct conversation already exists
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

      // 6. Create conversation + both members atomically
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

  /**
   * List all conversations for the user in a workspace
   */
  async listUserConversations(
    workspaceSlug: string,
    currentUserId: string,
    type?: ConversationType,
  ) {
    return withSpan("conversation.listUserConversations", async () => {
      const workspace = await this.repository.findWorkspaceBySlug(workspaceSlug);
      if (!workspace) {
        throw new AppError(404, "WORKSPACE_NOT_FOUND");
      }

      const membership = await this.repository.findWorkspaceMembership(
        workspace.id,
        currentUserId,
      );
      if (!membership) {
        throw new AppError(403, "FORBIDDEN");
      }

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

  /**
   * Get single conversation details by ID
   */
  async getConversationById(
    workspaceSlug: string,
    currentUserId: string,
    conversationId: string,
  ) {
    return withSpan("conversation.getConversationById", async () => {
      const workspace = await this.repository.findWorkspaceBySlug(workspaceSlug);
      if (!workspace) {
        throw new AppError(404, "WORKSPACE_NOT_FOUND");
      }

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

