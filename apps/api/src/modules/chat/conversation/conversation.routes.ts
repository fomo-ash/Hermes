import { Router } from "express";
import { asyncHandler } from "../../../common/utils/async-handler";
import { validate } from "../../../middleware/validate.middleware";
import * as conversationController from "./conversation.controller";
import {
  getOrCreateDmSchema,
  listConversationsSchema,
  getConversationByIdSchema,
  sendMessageSchema,
  messageHistoryQuerySchema,
  markReadSchema,
} from "./conversation.schema";

const router = Router({ mergeParams: true });

// POST /api/v1/workspaces/:workspaceSlug/chat/conversations/direct
router.post(
  "/direct",
  validate(getOrCreateDmSchema),
  asyncHandler(conversationController.getOrCreateDirectMessage),
);

// GET /api/v1/workspaces/:workspaceSlug/chat/conversations
router.get(
  "/",
  validate(listConversationsSchema),
  asyncHandler(conversationController.listConversations),
);

// GET /api/v1/workspaces/:workspaceSlug/chat/conversations/:conversationId
router.get(
  "/:conversationId",
  validate(getConversationByIdSchema),
  asyncHandler(conversationController.getConversationById),
);

// POST /api/v1/workspaces/:workspaceSlug/chat/conversations/:conversationId/messages
router.post(
  "/:conversationId/messages",
  validate(sendMessageSchema),
  asyncHandler(conversationController.sendMessage),
);

// GET /api/v1/workspaces/:workspaceSlug/chat/conversations/:conversationId/messages
router.get(
  "/:conversationId/messages",
  validate(messageHistoryQuerySchema),
  asyncHandler(conversationController.getMessages),
);

// PATCH /api/v1/workspaces/:workspaceSlug/chat/conversations/:conversationId/read
router.patch(
  "/:conversationId/read",
  validate(markReadSchema),
  asyncHandler(conversationController.markConversationAsRead),
);

export default router;
