import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import passport from "passport";
import lusca from "lusca";
import crypto from "crypto";

// Load Passport strategy configuration before route definitions
import "./config/passport";
import authRouter from "./modules/auth/auth.routes";

import healthRoute from "./modules/health/health.routes";
import { authMiddelware } from "./middleware/auth.middleware";
import onboardingRouter from "./modules/onboarding/onboarding.routes";
import workspaceRouter from "./modules/workspace/workspace.route";
import presenceRouter from "./modules/presence/presence.routes";

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

// Cross-Site Request Forgery (CSRF) Protection
app.use(
  lusca.csrf({
    key: "_csrf",
    secret: "_csrfSecret",
    header: "x-csrf-token",
    cookie: {
      name: "_csrf",
      options: {
        httpOnly: false,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
      },
    },
    impl: {
      create: (req: express.Request) => {
        const existingToken = req.cookies?._csrf;
        const token = existingToken || crypto.randomBytes(24).toString("hex");

        return {
          secret: token,
          token,
          validate: (req: express.Request, tokenHeader: unknown) => {
            // If the request is not authenticated via session cookie, CSRF does not apply
            if (!req.cookies?.token) {
              return true;
            }

            const headerToken =
              typeof tokenHeader === "string"
                ? tokenHeader
                : (req.headers["x-csrf-token"] as string) ||
                  (req.headers["x-xsrf-token"] as string);

            const cookieToken = req.cookies?._csrf;

            if (!headerToken || !cookieToken) {
              return false;
            }

            return (
              headerToken.length === cookieToken.length &&
              crypto.timingSafeEqual(
                Buffer.from(headerToken),
                Buffer.from(cookieToken),
              )
            );
          },
        };
      },
    },
  }),
);

// rate limiting
app.use(
  rateLimit({
    capacity: 60,
    refillRate: 2, // 2  tokens/sec refillrate,
    message: "Too many requests to the API , slow down !!",
  }),
);

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
app.use("/api/v1/presence", presenceRouter);

// Global Interception Middleware for standard error structures
app.use(errorMiddleware);

export default app;
