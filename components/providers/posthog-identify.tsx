"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";

/**
 * Keeps PostHog's identity in sync with the NextAuth session on every page load.
 *
 * The login/register flows identify on a *fresh* credential sign-in, but a
 * returning visitor with a live session cookie is never re-identified — their
 * events get attributed to a new anonymous id until they sign in again. This
 * component closes that gap: it identifies on session restore and resets on
 * logout. Renders nothing.
 */
export function PostHogIdentify() {
  const { data: session, status } = useSession();
  // Tracks the distinctId we last sent to PostHog so we don't re-identify (or
  // reset) on every render — only when the authenticated user actually changes.
  const lastIdentifiedId = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user?.id) {
      const userId = session.user.id;
      if (lastIdentifiedId.current === userId) return;
      posthog.identify(userId, {
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
        role: session.user.role,
      });
      lastIdentifiedId.current = userId;
      return;
    }

    // Unauthenticated: clear identity only if we'd previously bound one, so a
    // logged-out anonymous visitor doesn't get reset on every navigation.
    if (status === "unauthenticated" && lastIdentifiedId.current !== null) {
      posthog.reset();
      lastIdentifiedId.current = null;
    }
  }, [status, session?.user?.id, session?.user?.email, session?.user?.name, session?.user?.role]);

  return null;
}
