"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, MapPinOff } from "lucide-react";

interface LocationTrackerProps {
  enabled?: boolean;
}

export function LocationTracker({ enabled: initialEnabled = false }: LocationTrackerProps) {
  const [tracking, setTracking] = useState(initialEnabled);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const sendLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await fetch("/api/provider/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });
          setLastUpdate(new Date().toLocaleTimeString());
          setError(null);
        } catch {
          setError("Failed to send location");
        }
      },
      () => {
        setError("Location access denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (tracking) {
      sendLocation();
      intervalRef.current = setInterval(sendLocation, 30_000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [tracking, sendLocation]);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={tracking ? "default" : "outline"}
        size="sm"
        onClick={() => setTracking(!tracking)}
      >
        {tracking ? (
          <>
            <MapPin className="mr-1 h-4 w-4" /> Tracking On
          </>
        ) : (
          <>
            <MapPinOff className="mr-1 h-4 w-4" /> Tracking Off
          </>
        )}
      </Button>
      {lastUpdate && (
        <span className="text-xs text-muted-foreground">Last: {lastUpdate}</span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
