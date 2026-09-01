import Redis from "ioredis";
import { env } from "../config/env";

const REDIS_URL = env.REDIS_URL || "redis://localhost:6379";

// redis client
export const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

// createing pub/ sub clients

export const createRedisClients = () => {
  const pub = new Redis(REDIS_URL);
  const sub = pub.duplicate();

  return { pub, sub };
};

redisClient.on("error", (err) => console.error("❌ Redis Client Error:", err));
redisClient.on("connect", () => console.log("✅ Redis Connected"));