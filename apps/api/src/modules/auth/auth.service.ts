import jwt from "jsonwebtoken"

import prisma from "../../lib/prisma"

// JWT function 
export const generateSessionToken = (user: { id: string; email: string }): string => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );
};

// get user details  GET : /me
export const getUserProfile = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, imageUrl: true, onboarded: true },
  });
};

