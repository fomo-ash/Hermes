import { Router } from "express";
import { ConversationMemberRole } from "@prisma/client";
import { asyncHandler } from "../../../common/utils/async-handler";
import { successResponse } from "../../../common/responses/api-response";
import { validate } from "../../../middleware/validate.middleware";
import { AuthRequest } from "../../../middleware/auth.middleware";
import { getIO } from "../../../lib/socket";
import * as service from "./group.service";
import * as schemas from "./group.schema";

const router = Router({ mergeParams: true });
const values = (req: AuthRequest) => ({ slug: req.params.workspaceSlug as string, userId: req.user!.id, groupId: req.params.conversationId as string });

router.get("/", validate(schemas.listGroupsSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { slug, userId } = values(req);
  res.json(successResponse(await service.listGroups(slug, userId)));
}));

router.post("/", validate(schemas.createGroupSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { slug, userId } = values(req);
  const group = await service.createGroup(slug, userId, req.body.title, req.body.description, req.body.memberUserIds);
  for (const member of group.members) getIO()?.to(`user:${member.userId}`).emit("chat:group:updated", { conversationId: group.id });
  res.status(201).json(successResponse(group));
}));

router.get("/:conversationId", validate(schemas.groupByIdSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { slug, userId, groupId } = values(req);
  res.json(successResponse(await service.getGroup(slug, userId, groupId)));
}));

router.patch("/:conversationId", validate(schemas.updateGroupSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { slug, userId, groupId } = values(req);
  const group = await service.updateGroup(slug, userId, groupId, req.body);
  for (const member of group.members) getIO()?.to(`user:${member.userId}`).emit("chat:group:updated", { conversationId: group.id });
  res.json(successResponse(group));
}));

router.delete("/:conversationId", validate(schemas.groupByIdSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { slug, userId, groupId } = values(req);
  const group = await service.getGroup(slug, userId, groupId);
  const result = await service.deleteGroup(slug, userId, groupId);
  for (const member of group.members) getIO()?.to(`user:${member.userId}`).emit("chat:group:deleted", { conversationId: groupId });
  res.json(successResponse(result));
}));

router.post("/:conversationId/members", validate(schemas.addGroupMembersSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { slug, userId, groupId } = values(req);
  const group = await service.addGroupMembers(slug, userId, groupId, req.body.userIds);
  for (const member of group.members) getIO()?.to(`user:${member.userId}`).emit("chat:group:updated", { conversationId: groupId });
  res.json(successResponse(group));
}));

router.delete("/:conversationId/members/:userId", validate(schemas.groupMemberSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { slug, userId, groupId } = values(req);
  const targetId = req.params.userId as string;
  const before = await service.getGroup(slug, userId, groupId);
  const result = await service.removeGroupMember(slug, userId, groupId, targetId);
  getIO()?.to(`user:${targetId}`).emit("chat:group:removed", { conversationId: groupId });
  for (const member of before.members) {
    if (member.userId !== targetId) getIO()?.to(`user:${member.userId}`).emit("chat:group:updated", { conversationId: groupId });
  }
  res.json(successResponse(result));
}));

router.patch("/:conversationId/members/:userId/role", validate(schemas.groupRoleSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { slug, userId, groupId } = values(req);
  const group = await service.changeGroupRole(slug, userId, groupId, req.params.userId as string, req.body.role as ConversationMemberRole);
  for (const member of group.members) getIO()?.to(`user:${member.userId}`).emit("chat:group:updated", { conversationId: groupId });
  res.json(successResponse(group));
}));

export default router;
