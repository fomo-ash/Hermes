"use client";

import { createContext, useContext, useEffect } from "react";
import type { Socket } from "socket.io-client";
import { socket } from "../lib/socket";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Ensure socket connects when workspace mounts
    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      console.log("✅ Socket Connected:", socket.id);
    };

    const onConnectError = (err: Error) => {
      console.error("❌ Socket Connection Error:", err.message);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);

    // Heartbeat to refresh Redis 60s TTL
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("heartbeat");
      }
    }, 25000); // 25 seconds

    return () => {
      clearInterval(heartbeatInterval);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}

