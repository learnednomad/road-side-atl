"use client";

import { useState, useEffect } from "react";

let cachedStatus: string | null = null;
let fetchPromise: Promise<string | null> | null = null;

function fetchProviderStatus(): Promise<string | null> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/provider/profile")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      cachedStatus = data?.status ?? null;
      return cachedStatus;
    })
    .catch((err) => {
      console.error("[useProviderStatus] Profile fetch failed:", err);
      return null;
    })
    .finally(() => {
      fetchPromise = null;
    });
  return fetchPromise;
}

export function useProviderStatus() {
  const [status, setStatus] = useState<string | null>(cachedStatus);

  useEffect(() => {
    let cancelled = false;
    fetchProviderStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => { cancelled = true; };
  }, []);

  return status;
}
