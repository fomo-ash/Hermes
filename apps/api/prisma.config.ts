import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma Client uses the pooled URL through the Neon WebSocket adapter.
// The Prisma CLI needs Neon's direct URL for migrations and introspection.
const pooledUrl = process.env.DATABASE_URL;
const directUrl = process.env.DATABASE_URL_UNPOOLED || (() => {
  if (!pooledUrl) return "";
  const url = new URL(pooledUrl);
  url.hostname = url.hostname.replace("-pooler.", ".");
  return url.toString();
})();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: directUrl },
});
