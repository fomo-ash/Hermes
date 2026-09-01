import { Server } from "socket.io";

import { PresenceRepository } from "./presence.repository";
import { PresenceEvents } from "./presence.types";

export class PresenceService {
  constructor(
    private repository: PresenceRepository,
    private io?: Server,
  ) {}

  // user connects
  async connect(userId: string, socketId: string) {
    const alreadyOnline = await this.repository.isOnline(userId);

    await this.repository.addConnection(userId, socketId);

    if (!alreadyOnline && this.io) {
      // if the user was not already online , then emit event ONLINE
      this.io.emit(PresenceEvents.ONLINE, {
        userId,
      });
    }
  }

  async disconnect(userId: string, socketId: string) {
    // remove socketID
    await this.repository.removeConnection(userId, socketId);

    const stillOnline = await this.repository.isOnline(userId);

    // once user disconnects
    if (!stillOnline && this.io) {
      this.io.emit(PresenceEvents.OFFLINE, { userId });
    }
  }

  async heartbeat(userId: string) {
    // refreshes redis set key
    await this.repository.refresh(userId);
  }

  async isOnline(userId: string): Promise<boolean> {
    return this.repository.isOnline(userId);
  }

  async getPresence(userIds: string[]): Promise<Record<string, boolean>> {
    return this.repository.getOnlineStatus(userIds);
  }
}
