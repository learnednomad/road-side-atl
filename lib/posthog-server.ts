import { PostHog } from "posthog-node";
import type { AnalyticsEvent } from "@/lib/analytics/events";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

/**
 * Fire-and-forget server-side event capture. Never throws — analytics must
 * never break a request. Event name is constrained to the catalog in
 * `lib/analytics/events.ts`. `distinctId` should be the customer `user.id`,
 * `provider:<providerId>`, or a stable fallback (e.g. booking id) for anon.
 */
export function captureServer(
  event: AnalyticsEvent,
  {
    distinctId,
    ...properties
  }: { distinctId: string } & Record<string, unknown>,
): void {
  try {
    getPostHogClient().capture({ distinctId, event, properties });
  } catch (err) {
    console.error("[PostHog] server capture failed:", err);
  }
}

export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
