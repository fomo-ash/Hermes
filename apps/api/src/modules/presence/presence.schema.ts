import { z } from "zod";

export const getPresenceQuerySchema = z.object({
  query: z.object({
    userIds: z
      .union([
        z.string(),
        z.array(z.string()),
      ])
      .optional(),
  }),
});

export const getPresenceBatchSchema = z.object({
  body: z.object({
    userIds: z
      .array(z.string().min(1, "userId cannot be empty"))
      .min(1, "userIds array must contain at least one user ID")
      .max(500, "Cannot query more than 500 users at once"),
  }),
});

export const getUserPresenceSchema = z.object({
  params: z.object({
    userId: z.string().min(1, "userId is required"),
  }),
});
