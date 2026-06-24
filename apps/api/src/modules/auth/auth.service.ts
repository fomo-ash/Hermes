import { clerkClient } from "@clerk/express";
import { prisma } from "../../lib/prisma";
import { AuthUser } from "./auth.types";
import { AppError } from "../../common/errors/app-error";
import { ErrorCode } from "../../common/errors/error-codes";

export class AuthService {
  async getCurrentUser(clerkId?: string): Promise<AuthUser> {
    if (!clerkId) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED);
    }

    const existingUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (existingUser) {
      return {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
      };
    }

    const clerkUser = await clerkClient.users.getUser(clerkId);

    if (!clerkUser) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED);
    }

    const emailAddress =
      clerkUser.primaryEmailAddress ??
      clerkUser.emailAddresses?.find(
        (email) => email.id === clerkUser.primaryEmailAddressId,
      ) ??
      clerkUser.emailAddresses?.[0];

    const email =
      emailAddress?.emailAddress ??
      clerkUser.primaryEmailAddress?.emailAddress ??
      "";
    const name =
      clerkUser.fullName ||
      `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
      "Unknown";

    const user = await prisma.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email,
        name,
        firstName: clerkUser.firstName ?? null,
        lastName: clerkUser.lastName ?? null,
        imageUrl: clerkUser.imageUrl ?? null,
      },
      update: {
        email,
        name,
        firstName: clerkUser.firstName ?? null,
        lastName: clerkUser.lastName ?? null,
        imageUrl: clerkUser.imageUrl ?? null,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}

export const authService = new AuthService();
