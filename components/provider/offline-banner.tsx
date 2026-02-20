"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Wifi } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Set initial state from navigator (only available client-side)
    setIsOffline(!navigator.onLine);

    function handleOffline() {
      setIsOffline(true);
      setShowReconnected(false);
    }

    function handleOnline() {
      setIsOffline(false);
      setShowReconnected(true);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    if (!showReconnected) return;

    const timer = setTimeout(() => {
      setShowReconnected(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showReconnected]);

  if (isOffline) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          You are offline. Some actions may not work until you reconnect.
        </span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 bg-green-100 px-4 py-2 text-sm font-medium text-green-900 dark:bg-green-900/30 dark:text-green-200"
      >
        <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Back online</span>
      </div>
    );
  }

  return null;
}
