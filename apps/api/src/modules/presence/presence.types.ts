export interface PresencePayload {
  userId: String;
}

export interface SocketUser {
  userId: string;
  socketId: string;
}

export enum PresenceEvents {
  ONLINE = "presence:online",
  OFFLINE = "presence:offline",
}

export const PRESENCE_KEY_PREFIX = "presence:user:";

export const PRESENCE_TTL_SECONDS = 60;