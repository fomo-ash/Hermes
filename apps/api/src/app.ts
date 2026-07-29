import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import passport from "passport";

// Load Passport strategy configuration before route definitions
import "./config/passport";
import authRouter from "./modules/auth/auth.routes";

import healthRoute from "./modules/health/health.routes";
import { authMiddelware } from "./middleware/auth.middleware";
import onboardingRouter from "./modules/onboarding/onboarding.routes"
import workspaceRouter from "./modules/workspace/workspace.route";

import { errorMiddleware } from "./middleware/error.middleware";
import { loggerMiddleware } from "./middleware/logger.middleware";
import { rateLimit } from "./middleware/ratelimiter.middleware";
import { env } from "./config/env";

const app = express();


app.use(helmet());
app.use(loggerMiddleware);
app.use(morgan("dev"));

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);



app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// rate limiting
app.use(rateLimit({
  capacity: 60,
  refillRate: 2, // 2  tokens/sec refillrate,
  message: "Too many requests to the API , slow down !!"
}))

// global auth middleware
app.use(authMiddelware);

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
