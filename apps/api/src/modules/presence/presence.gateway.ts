import { Server, Socket } from "socket.io";

import { PresenceRepository } from "./presence.repository";
import { PresenceService } from "./presence.service";
import { addAbortListener } from "events";

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
  };
}

export function initializePresence(io: Server) {
  const repository = new PresenceRepository();

  const service = new PresenceService(repository, io);

  io.on("connection", async (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;

    if (!userId) {
      socket.disconnect(true);
    }

    await service.connect(userId, socket.id);
    console.log("Socket Connected");
    console.log(socket.id);
    console.log(socket.data.userId);

    socket.join(`user:${userId}`);

    socket.on("heartbeat", async () => {
      await service.heartbeat(userId);
    });

    socket.on("disconnect", async () => {
      await service.disconnect(userId, socket.id);
    });
  });
}
