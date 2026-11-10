import { z } from "zod";

export const getOrCreateDmSchema = z.object({
  params: z.object({
    workspaceSlug: z.string().min(1, "Workspace slug is required"),
  }),
  body: z.object({
    recipientUserId: z.string().uuid("Invalid recipient user ID format"),
  }),
});

export const listConversationsSchema = z.object({
  params: z.object({
    workspaceSlug: z.string().min(1, "Workspace slug is required"),
  }),
  query: z.object({
    type: z.enum(["DIRECT", "GROUP"]).optional(),
  }).optional(),
});

export const getConversationByIdSchema = z.object({
  params: z.object({
    workspaceSlug: z.string().min(1, "Workspace slug is required"),
    conversationId: z.string().uuid("Invalid conversation ID format"),
  }),
});

export type GetOrCreateDmInput = z.infer<typeof getOrCreateDmSchema>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
export type GetConversationByIdInput = z.infer<typeof getConversationByIdSchema>;

