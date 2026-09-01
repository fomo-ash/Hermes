// capture intial snapshot

// listens for online/ offline events , from socket server

//provides , lookup -

import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../providers/SocketProvider";
import { api } from "../lib/auth";
export function usePresence(userIds: string[]) {
  const socket = useSocket();

  //   map to store presence {userId : Boolean}

  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(false);

  //  Fetch initial snapshot from API endpoint
  const fetchInitialPresence = useCallback(async () => {
    if (!userIds || userIds.length === 0) return;
    try {
      setIsLoading(true);

      const res = await api.post("/api/v1/presence", { userIds });
      const data = res?.data?.data || res?.data;

      if (data && typeof data === "object") {
        setPresenceMap((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Failed to fetch initial presence:", err);
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(userIds)]);
  useEffect(() => {
    fetchInitialPresence();
  }, [fetchInitialPresence]);



  // Listen to real-time socket events
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      fetchInitialPresence();
    };

    const handleUserOnline = (data: { userId: string }) => {
      setPresenceMap((prev) => ({
        ...prev,
        [data.userId]: true,
      }));
    };

    const handleUserOffline = (data: { userId: string }) => {
      setPresenceMap((prev) => ({
        ...prev,
        [data.userId]: false,
      }));
    };

    socket.on("connect", handleConnect);
    socket.on("presence:online", handleUserOnline);
    socket.on("presence:offline", handleUserOffline);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("presence:online", handleUserOnline);
      socket.off("presence:offline", handleUserOffline);
    };
  }, [socket, fetchInitialPresence]);

  return {
    presenceMap,
    isOnline: (userId: string) => Boolean(presenceMap[userId]),
    isLoading,
    refetch: fetchInitialPresence,
  };
}
