import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { clerkMiddleware } from "@clerk/express";

import healthRoute from "./modules/health/health.routes";
import authRoutes from "./modules/auth/auth.routes";
import clerkWebhookRoute from "./modules/webhooks/clerk.routes";
import { authMiddleware } from "./middleware/auth.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import { loggerMiddleware } from "./middleware/logger.middleware";

const app = express();

app.use(helmet());
app.use(loggerMiddleware);
app.use(morgan("dev"));
app.use("/webhooks/clerk", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(clerkMiddleware());
app.use(cors());

app.get("/", (_req, res) => {
  res.json({
    message: "API running",
  });
});

app.get("/api/profile", authMiddleware, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      userId: req.auth?.userId,
      sessionId: req.auth?.sessionId,
    },
    error: null,
  });
});

app.use("/health", healthRoute);
app.use("/webhooks/clerk", clerkWebhookRoute);
app.use("/api/auth", authRoutes);

app.use(errorMiddleware);

export default app;
