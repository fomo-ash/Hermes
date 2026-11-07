import "./observability/instrumentation.js";
import app from "./app";
import http from "http";
import { env } from "./config/env";
import { createSocketServer } from "./lib/socket";
import { shutdownTelemetry } from "./observability/index.js";

const PORT = env.PORT;

// http server
const server = http.createServer(app);

// attach socket.io connection
createSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await shutdownTelemetry();
    process.exit(0);
  });
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
