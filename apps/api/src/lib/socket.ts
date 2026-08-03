import type { Server as HttpServer } from "node:http";
import { Server as IOServer } from "socket.io";

import { env } from "../config/env";
import { socketMiddleware } from "../middleware/socket.middleware";
import { initializePresence } from "../modules/presence/presence.gateway";

export function createSocketServer(server: HttpServer) {
  const io = new IOServer(server, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use(socketMiddleware);
  initializePresence(io);

  return io;
}
