import { z } from "zod";

const workspace = z.object({ workspaceSlug: z.string().min(1) });
const group = workspace.extend({ conversationId: z.string().uuid() });
const member = group.extend({ userId: z.string().uuid() });
const ids = z.array(z.string().uuid()).min(1).max(100);

export const listGroupsSchema = z.object({ params: workspace });
export const createGroupSchema = z.object({
  params: workspace,
  body: z.object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    memberUserIds: ids,
  }),
});
export const groupByIdSchema = z.object({ params: group });
export const updateGroupSchema = z.object({
  params: group,
  body: z.object({
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    iconUrl: z.string().url().max(2048).nullable().optional(),
  }).refine((value) => Object.keys(value).length > 0),
});
export const addGroupMembersSchema = z.object({ params: group, body: z.object({ userIds: ids }) });
export const groupMemberSchema = z.object({ params: member });
export const groupRoleSchema = z.object({
  params: member,
  body: z.object({ role: z.enum(["OWNER", "ADMIN", "MEMBER"]) }),
});
