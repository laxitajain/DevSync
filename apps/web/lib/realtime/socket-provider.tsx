"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../store/auth-store";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setSocket(null);
      return;
    }

    const instance = io(WS_URL, {
      auth: { token: accessToken },
      transports: ["websocket"]
    });

    setSocket(instance);

    return () => {
      instance.disconnect();
    };
  }, [accessToken]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
