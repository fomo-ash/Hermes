import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../common/errors/app-error";
import { ErrorCode } from "../common/errors/error-codes";

export const errorMiddleware = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.log("━━━━━━━━━━━━━━━ BACKEND ERROR LOG ━━━━━━━━━━━━━━━");
  console.error(err);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Check against the 'err' object directly
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      data: null,
      error: err.errorCode,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      data: null,
      error: ErrorCode.INVALID_REQUEST,
    });
  }

  // Handle CSRF validation errors from lusca/csurf
  if (err.message && err.message.includes("CSRF")) {
    return res.status(403).json({
      success: false,
      data: null,
      error: "INVALID_CSRF_TOKEN",
    });
  }

  return res.status(500).json({
    success: false,
    data: null,
    error: ErrorCode.INTERNAL_SERVER_ERROR,
  });
};
