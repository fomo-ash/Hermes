import { pipe } from "zod";
import { redisClient } from "../../lib/redis.client";
import { PRESENCE_KEY_PREFIX, PRESENCE_TTL_SECONDS } from "./presence.types";

export class PresenceRepository {
  private getKey(userId: string) {
    return `${PRESENCE_KEY_PREFIX}${userId}`;
  }

  async addConnection(userId: string, socketId: string) {
    const key = this.getKey(userId);

    // redis set
    await redisClient.sadd(key, socketId);

    await redisClient.expire(key, PRESENCE_TTL_SECONDS);
  }

  async removeConnection(userId: string, socketId: string) {
    const key = this.getKey(userId);

    await redisClient.srem(key, socketId);
  }

  async refresh(userId: string) {
    // reset the expiration time,
    await redisClient.expire(this.getKey(userId), PRESENCE_TTL_SECONDS);
  }

  // number of connections a user has
  async connectionCount(userId: string): Promise<number> {
    return redisClient.scard(this.getKey(userId));
  }

  // if the connection count if > 0 , then the user is online
  async isOnline(userId: string): Promise<boolean> {
    return (await this.connectionCount(userId)) > 0;
  }

  async getOnlineStatus(userIds: string[]): Promise<Record<string, boolean>> {
    if (!userIds || userIds.length === 0) {
      return {};
    }
    const pipeline = redisClient.pipeline();

    userIds.forEach((id) => pipeline.scard(this.getKey(id)));

    const result = await pipeline.exec(); //efficient method for checking all users prsence

    const status: Record<string, boolean> = {};
    result?.forEach((item, index) => {
      const count = typeof item?.[1] === "number" ? item[1] : 0;
      status[userIds[index]] = count > 0;
    });
    
    return status;
  }

}
