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

export const sendMessageSchema = z.object({
  params: z.object({
    workspaceSlug: z.string().min(1, "Workspace slug is required"),
    conversationId: z.string().uuid("Invalid conversation ID format"),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, "Message content cannot be empty")
      .max(4000, "Message cannot exceed 4000 characters"),
    clientMessageId: z.string().uuid("Invalid clientMessageId format"),
  }),
});

export const messageHistoryQuerySchema = z.object({
  params: z.object({
    workspaceSlug: z.string().min(1, "Workspace slug is required"),
    conversationId: z.string().uuid("Invalid conversation ID format"),
  }),
  query: z
    .object({
      beforeSequence: z
        .preprocess(
          (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
          z.number().int().positive().optional(),
        ),
      limit: z
        .preprocess(
          (val) => (val !== undefined && val !== "" ? Number(val) : 50),
          z.number().int().min(1).max(100).optional(),
        )
        .default(50),
    })
    .optional(),
});

export const markReadSchema = z.object({
  params: z.object({
    workspaceSlug: z.string().min(1, "Workspace slug is required"),
    conversationId: z.string().uuid("Invalid conversation ID format"),
  }),
  body: z.object({
    sequence: z.number().int().min(0, "Read sequence must be non-negative"),
  }),
});

export type GetOrCreateDmInput = z.infer<typeof getOrCreateDmSchema>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
export type GetConversationByIdInput = z.infer<typeof getConversationByIdSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageHistoryQueryInput = z.infer<typeof messageHistoryQuerySchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;

