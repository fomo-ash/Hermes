import { z } from "zod";

export const getPresenceSchema = z.object({
  body: z.object({
    userIds: z
      .array(z.string().min(1, "userId cannot be empty"))
      .min(1, "userIds array must contain at least one user ID")
      .max(500, "Cannot query more than 500 users at once"),
  }),
});
