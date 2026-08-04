"use client";

import { createContext, useContext, useEffect } from "react";
import { socket } from "../lib/socket";

const SocketContext = createContext(socket);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      console.log("✅ Socket Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket Disconnected:", reason);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
