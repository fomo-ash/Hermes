import { Request, Response } from "express";
import { authService } from "./auth.service";

export class AuthController {
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    const clerkId = req.user?.clerkId;
    const user = await authService.getCurrentUser(clerkId);

    res.status(200).json({
      success: true,
      data: user,
      error: null,
    });
  }
}

export const authController = new AuthController();
