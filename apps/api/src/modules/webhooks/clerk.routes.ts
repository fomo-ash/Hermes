import { Router, Request, Response } from "express";
import { Webhook } from "svix";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";

type ClerkUserCreatedPayload = {
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email_addresses: Array<{
      email_address: string;
      id: string;
      is_primary: boolean;
    }>;
    image_url?: string | null;
  };
  type: string;
};

const router = Router();
const webhook = new Webhook(env.CLERK_WEBHOOK_SECRET);

function getPrimaryEmail(
  emailAddresses: ClerkUserCreatedPayload["data"]["email_addresses"],
) {
  const primary = emailAddresses.find((address) => address.is_primary);
  return primary?.email_address ?? emailAddresses[0]?.email_address ?? "";
}

router.post("/", async (req: Request, res: Response) => {
  const rawBody =
    req.body instanceof Buffer
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

  const rawHeaders = Object.entries(req.headers).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (!value) return acc;
      acc[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
      return acc;
    },
    {},
  );

  const normalizedHeaders: Record<string, string> = {
    "webhook-id":
      rawHeaders["clerk-id"] ??
      rawHeaders["svix-id"] ??
      rawHeaders["webhook-id"] ??
      "",
    "webhook-timestamp":
      rawHeaders["clerk-timestamp"] ??
      rawHeaders["svix-timestamp"] ??
      rawHeaders["webhook-timestamp"] ??
      "",
    "webhook-signature":
      rawHeaders["clerk-signature"] ??
      rawHeaders["svix-signature"] ??
      rawHeaders["webhook-signature"] ??
      "",
  };

  if (
    !normalizedHeaders["webhook-signature"] ||
    !normalizedHeaders["webhook-timestamp"]
  ) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Missing Clerk webhook signature headers.",
      });
  }

  let event;
  try {
    event = webhook.verify(rawBody, normalizedHeaders) as {
      type: string;
      data: ClerkUserCreatedPayload["data"];
    };
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid webhook signature." });
  }

  const payload = event.data;
  const clerkId = payload.id;
  const email = getPrimaryEmail(payload.email_addresses);
  const firstName = payload.first_name ?? null;
  const lastName = payload.last_name ?? null;
  const imageUrl = payload.image_url ?? null;

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated":
        await prisma.user.upsert({
          where: { clerkId },
          create: {
            clerkId,
            email,
            firstName,
            lastName,
            name: [firstName, lastName].filter(Boolean).join(" ") || email,
            imageUrl,
          },
          update: {
            email,
            firstName,
            lastName,
            name: [firstName, lastName].filter(Boolean).join(" ") || email,
            imageUrl,
          },
        });
        break;

      case "user.deleted":
        await prisma.user.deleteMany({ where: { clerkId } });
        break;

      default:
        break;
    }

    return res.status(200).json({ success: true, data: null, error: null });
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: "Webhook processing failed.",
    });
  }
});

export default router;
