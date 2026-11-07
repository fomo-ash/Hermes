import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.string().default("8000"),
  DATABASE_URL: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  JWT_SECRET: z.string(),
  FRONTEND_URL: z.string(),
  REDIS_URL: z.string(),
  OTEL_SERVICE_NAME: z.string().optional().default("hermes-api"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  SIGNOZ_INGESTION_KEY: z.string().optional(),
  ENABLE_OTEL: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

export const env = envSchema.parse(process.env);
