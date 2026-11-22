import { Response } from "express";
import { AuthRequest } from "../../../middleware/auth.middleware";
import { successResponse } from "../../../common/responses/api-response";
import { ConversationRepository } from "./conversation.repository";
import { ConversationService } from "./conversation.service";
import { ConversationType } from "@prisma/client";

const repository = new ConversationRepository();
const service = new ConversationService(repository);

// POST /api/v1/workspaces/:workspaceSlug/chat/conversations/direct
export const getOrCreateDirectMessage = async (
  req: AuthRequest,
  res: Response,
) => {
  const currentUserId = req.user!.id;
  const workspaceSlug = req.params.workspaceSlug as string;
  const { recipientUserId } = req.body;

  const { conversation, isNew } = await service.getOrCreateDirectMessage(
    workspaceSlug,
    currentUserId,
    recipientUserId,
  );

  return res.status(isNew ? 201 : 200).json(successResponse(conversation));
};

// GET /api/v1/workspaces/:workspaceSlug/chat/conversations
export const listConversations = async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const workspaceSlug = req.params.workspaceSlug as string;
  const type = req.query.type as ConversationType | undefined;

  const conversations = await service.listUserConversations(
    workspaceSlug,
    currentUserId,
    type,
  );

  return res.status(200).json(successResponse(conversations));
};

// GET /api/v1/workspaces/:workspaceSlug/chat/conversations/:conversationId
export const getConversationById = async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const workspaceSlug = req.params.workspaceSlug as string;
  const conversationId = req.params.conversationId as string;

  const conversation = await service.getConversationById(
    workspaceSlug,
    currentUserId,
    conversationId,
  );

  return res.status(200).json(successResponse(conversation));
};

// POST /api/v1/workspaces/:workspaceSlug/chat/conversations/:conversationId/messages
export const sendMessage = async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const workspaceSlug = req.params.workspaceSlug as string;
  const conversationId = req.params.conversationId as string;
  const { content, clientMessageId } = req.body;

  const { message, isReplay } = await service.sendMessage({
    workspaceSlug,
    conversationId,
    senderId: currentUserId,
    content,
    clientMessageId,
  });

  return res.status(isReplay ? 200 : 201).json(successResponse(message));
};

// GET /api/v1/workspaces/:workspaceSlug/chat/conversations/:conversationId/messages
export const getMessages = async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const workspaceSlug = req.params.workspaceSlug as string;
  const conversationId = req.params.conversationId as string;
  const beforeSequence = req.query.beforeSequence
    ? Number(req.query.beforeSequence)
    : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;

  const result = await service.getMessages({
    workspaceSlug,
    conversationId,
    userId: currentUserId,
    beforeSequence,
    limit,
  });

  return res.status(200).json(successResponse(result));
};

// PATCH /api/v1/workspaces/:workspaceSlug/chat/conversations/:conversationId/read
export const markConversationAsRead = async (
  req: AuthRequest,
  res: Response,
) => {
  const currentUserId = req.user!.id;
  const workspaceSlug = req.params.workspaceSlug as string;
  const conversationId = req.params.conversationId as string;
  const { sequence } = req.body;

  const result = await service.markConversationAsRead({
    workspaceSlug,
    conversationId,
    userId: currentUserId,
    sequence: Number(sequence),
  });

  return res.status(200).json(successResponse(result));
};
