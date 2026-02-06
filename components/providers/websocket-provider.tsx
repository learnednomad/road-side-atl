"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useWebSocket } from "@/lib/hooks/use-websocket";

interface WSContextValue {
  lastEvent: { type: string; data?: unknown } | null;
  isConnected: boolean;
  send: (message: { type: string; data?: unknown }) => void;
}

const WSContext = createContext<WSContextValue>({
  lastEvent: null,
  isConnected: false,
  send: () => {},
});

export function useWS() {
  return useContext(WSContext);
}

interface WebSocketProviderProps {
  children: ReactNode;
  userId?: string;
  role?: string;
}

export function WebSocketProvider({ children, userId, role }: WebSocketProviderProps) {
  const ws = useWebSocket({
    userId,
    role,
    enabled: !!userId,
  });

  return <WSContext.Provider value={ws}>{children}</WSContext.Provider>;
}
