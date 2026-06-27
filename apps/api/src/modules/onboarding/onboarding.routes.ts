import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../../common/utils/async-handler";
import { successResponse } from "../../common/responses/api-response";
import { AuthRequest, requireAuth } from "../../middleware/auth.middleware";
import { rateLimit } from "../../middleware/ratelimiter.middleware";

const router = Router();
const prisma = new PrismaClient();

const checkUsernameLimiter = rateLimit(
    { capacity: 5, refillRate: 1 },
    "Too many username checks. Please slow down."
);

router.get(
    "/check-username",
    checkUsernameLimiter,
    asyncHandler(async (req, res) => {
        const { username } = req.query;
        if (!username || typeof username !== "string" || !username.trim()) {
            return res.status(400).json({ message: "Username is Required field" });
        }

        const sanitisedUsername = username.trim().toLowerCase();
        const isUsernameTaken = await prisma.user.findUnique({
            where: { username: sanitisedUsername },
        });

        res.status(200).json(
            successResponse({
                available: !isUsernameTaken,
                message: `Username ${username} is ${isUsernameTaken ? "taken" : "available"}`,
            })
        );
    })
);

router.post(
    "/",
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
        const { username, imageUrl } = req.body;

        if (!username || typeof username !== "string" || !username.trim()) {
            return res.status(400).json({ message: "Username is required" });
        }

        const sanitisedUsername = username.trim().toLowerCase();
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const existingUser = await prisma.user.findUnique({
            where: { username: sanitisedUsername },
        });

        // Don't block if it's already their own username
        if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({ message: "Username already taken" });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                username: sanitisedUsername,
                imageUrl: imageUrl || undefined,
                onboarded: true,
            },
        });

        res.status(200).json(
            successResponse({
                userId: updatedUser.id,
                username: updatedUser.username,
                imageUrl: updatedUser.imageUrl,
                email: updatedUser.email,
            })
        );
    })
);

export default router;
