"use client";

import { useState, useEffect, useRef } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let initialized = false;

function initLoader(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return false;

  if (!initialized) {
    setOptions({
      key: apiKey,
      v: "weekly",
    });
    initialized = true;
  }
  return true;
}

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    if (!initLoader()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initialization error handling
      setError("Google Maps API key not configured");
      return;
    }

    loadedRef.current = true;
    Promise.all([
      importLibrary("places"),
      importLibrary("marker"),
    ])
      .then(() => setIsLoaded(true))
      .catch(() => setError("Failed to load Google Maps"));
  }, []);

  return { isLoaded, error };
}
