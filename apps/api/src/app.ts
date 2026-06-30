import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import passport from "passport";

// Load Passport strategy configuration before route definitions
import "./config/passport";

import healthRoute from "./modules/health/health.routes";
import authRouter from "./modules/auth/auth.routes"
import onboardingRouter from "./modules/onboarding/onboarding.routes"
import workspaceRouter from "./modules/workspace/workspace.route";

import { errorMiddleware } from "./middleware/error.middleware";
import { loggerMiddleware } from "./middleware/logger.middleware";

const app = express();


app.use(helmet());
app.use(loggerMiddleware);
app.use(morgan("dev"));

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Parsers and Lifecycle Handlers
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());


app.get("/", (_req, res) => {
  res.json({
    message: "API running",
  });
});


app.use("/api/v1/auth", authRouter);
app.use("/health", healthRoute);
app.use("/api/v1/onboarding", onboardingRouter);
app.use("/api/v1/workspaces", workspaceRouter);

// Global Interception Middleware for standard error structures
app.use(errorMiddleware);

export default app;
