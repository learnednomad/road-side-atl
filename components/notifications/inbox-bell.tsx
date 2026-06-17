"use client";

/**
 * In-app notification bell powered by Novu's self-hosted Inbox.
 *
 * Self-contained and safe to drop into any authenticated layout: it renders
 * nothing until it has fetched a valid Inbox config from /api/novu/inbox-config
 * (which returns { enabled:false } when NOVU_ENABLED is off, or when the user is
 * unauthenticated). The HMAC subscriberHash is minted server-side so a user can
 * only read their own feed.
 *
 * Requires the `@novu/react` package (added to package.json).
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Inbox } from "@novu/react";

type InboxConfig = {
  enabled: boolean;
  subscriberId?: string;
  subscriberHash?: string;
  applicationIdentifier?: string;
  backendUrl?: string;
  socketUrl?: string;
};

export function InboxBell() {
  const { status } = useSession();
  const [cfg, setCfg] = useState<InboxConfig | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/novu/inbox-config")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((data: InboxConfig) => {
        if (!cancelled) setCfg(data);
      })
      .catch(() => {
        if (!cancelled) setCfg({ enabled: false });
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status !== "authenticated") return null;
  if (!cfg?.enabled || !cfg.subscriberId || !cfg.applicationIdentifier) return null;

  return (
    <Inbox
      applicationIdentifier={cfg.applicationIdentifier}
      subscriber={cfg.subscriberId}
      subscriberHash={cfg.subscriberHash}
      backendUrl={cfg.backendUrl}
      socketUrl={cfg.socketUrl}
    />
  );
}
