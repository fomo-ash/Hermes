import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { AppError } from "../common/errors/app-error";
import { ErrorCode } from "../common/errors/error-codes";

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const auth = getAuth(req);

    if (!auth.userId) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED);
    }

    req.auth = {
      userId: auth.userId,
      sessionId: auth.sessionId,
    };
    req.user = {
      clerkId: auth.userId,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      error: ErrorCode.UNAUTHORIZED,
    });
  }
};
