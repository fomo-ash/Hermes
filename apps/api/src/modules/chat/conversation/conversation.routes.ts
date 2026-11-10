import { Router } from "express";
import { asyncHandler } from "../../../common/utils/async-handler";
import { validate } from "../../../middleware/validate.middleware";
import * as conversationController from "./conversation.controller";
import {
  getOrCreateDmSchema,
  listConversationsSchema,
  getConversationByIdSchema,
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

export default router;

