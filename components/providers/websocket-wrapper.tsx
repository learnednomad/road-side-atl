"use client";

import { useEffect, useState, type ReactNode } from "react";
import { WebSocketProvider } from "./websocket-provider";

interface SessionData {
  user?: { id: string; role: string };
}

export function WebSocketWrapper({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setSession(data))
      .catch(() => {});
  }, []);

  return (
    <WebSocketProvider
      userId={session?.user?.id}
      role={session?.user?.role}
    >
      {children}
    </WebSocketProvider>
  );
}
