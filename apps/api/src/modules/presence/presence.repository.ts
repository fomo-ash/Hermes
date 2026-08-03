import { pipe } from "zod";
import { redisClient } from "../../lib/redis.client";
import { PRESENCE_KEY_PREFIX, PRESENCE_TTL_SECONDS } from "./presence.types";

export class PresenceRepository {
    private getKey(userId: string) {
        return `${PRESENCE_KEY_PREFIX}${userId}`;
    }

    async  addConnection( userId: string, socketId: string) {
        const key = this.getKey(userId)

        // redis set
        await redisClient.sadd(key, socketId)

        await redisClient.expire(key , PRESENCE_TTL_SECONDS )
    }

    async removeConnection ( userId: string, socketId : string){
        const key = this.getKey(userId)

        await redisClient.srem(key, socketId)
    }

    async refresh(userId: string){
        await redisClient.expire(
            this.getKey(userId),
            PRESENCE_TTL_SECONDS
        )
    }

    // number of connections a user has
    async connectionCount( userId: string) : Promise<number> {
        return redisClient.scard(this.getKey(userId))
    }

    // if the connection count if > 0 , then the user is online 
    async isOnline(userId: string): Promise<boolean> {
        return (await this.connectionCount(userId)) > 0;
    }

    async getOnlineStatus(userIds: string[]){
        const pipeline= redisClient.pipeline()

        userIds.forEach((id)=>
        pipeline.scard(this.getKey(id)));

        const result = await pipeline.exec();

        const status = new Map<string, boolean>();

        result?.forEach((item , index)=> {
            status.set(userIds[index], (item[1] as number )> 0)
        })

        return status
    }

}