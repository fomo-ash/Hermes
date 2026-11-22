import type { Server as HttpServer } from "node:http";
import { Server as IOServer } from "socket.io";

import { env } from "../config/env";
import { socketMiddleware } from "../middleware/socket.middleware";
import { initializePresence } from "../modules/presence/presence.gateway";

let ioInstance: IOServer | null = null;

export function createSocketServer(server: HttpServer) {
  ioInstance = new IOServer(server, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  ioInstance.use(socketMiddleware);
  initializePresence(ioInstance);

  return ioInstance;
}

export function getIO(): IOServer | null {
  return ioInstance;
}
