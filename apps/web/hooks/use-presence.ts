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

  //  Fetch initial snapshot from  API endpoint
  const fetchInitialPresence = useCallback(async () => {
    if (!userIds || userIds.length === 0) return;
    try {
      setIsLoading(true);

      const res = await api.post("/api/v1/presence", { userIds });

      if (res.data?.data) {
        setPresenceMap(res.data.data);
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

    socket.on("presence:online", handleUserOnline);

    socket.on("presence:offline", handleUserOffline);

    return () => {
      socket.off("presence:online", handleUserOnline);
      socket.off("presence:offline", handleUserOffline);
    };

  }, [socket]);

  return {
    presenceMap,
    isOnline: (userId: string) => Boolean(presenceMap[userId]),
    isLoading,
    refetch: fetchInitialPresence,
  };
}
