import dotenv from "dotenv"
import {z} from "zod"

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.string().default("8000"),
  DATABASE_URL: z.string(),
});

export const env = envSchema.parse(process.env)
