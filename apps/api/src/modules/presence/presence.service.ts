import {Server } from "socket.io"

import { PresenceRepository } from "./presence.repository"
import { PresenceEvents } from "./presence.types"

export class PresenceService{
    constructor(
        private repository: PresenceRepository, 
        private io: Server
    ) {}
    
    
    async connect(userId: string, socketId: string){
        const alreadyOnline =  await this.repository.isOnline(userId)
        
        await this.repository.addConnection(userId, socketId)

        if (!alreadyOnline){
            // if the user was not already online , then emit event ONLINE
            this.io.emit(PresenceEvents.ONLINE, {
                userId
            })
        }
    }

    async disconnect(userId: string, socketId: string){
        await this.repository.removeConnection(userId, socketId)

        const stillOnline= await this.repository.isOnline(userId)

        // once user disconnects
        if ( !stillOnline) {
            this.io.emit(PresenceEvents.OFFLINE, {userId})
        }
    }

    async heartbeat (userId: string){
        await this.repository.refresh(userId)
    }

    async isOnline(userId:string){
        return this.repository.isOnline(userId)
    }

    async getPresence(userIds: string[]){
        return this.repository.getOnlineStatus(userIds)
    }
}