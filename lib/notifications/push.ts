import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL || "support@roadsideatl.com"}`,
    vapidPublicKey,
    vapidPrivateKey
  );
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Send push notification to a specific user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("Push notifications disabled - VAPID keys not configured");
    return { sent: 0, failed: 0 };
  }

  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, userId),
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/icon-192x192.png",
          badge: payload.badge || "/icon-72x72.png",
          data: {
            url: payload.url || "/",
            ...payload.data,
          },
          tag: payload.tag,
        })
      );
      sent++;
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      // If subscription is invalid, remove it
      if (error.statusCode === 410 || error.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
      failed++;
      console.error("Failed to send push notification:", error.message || err);
    }
  }

  return { sent, failed };
}

/**
 * Send booking status update notification
 */
export async function notifyBookingStatusPush(
  userId: string,
  bookingId: string,
  status: string
): Promise<void> {
  const statusMessages: Record<string, { title: string; body: string }> = {
    confirmed: {
      title: "Booking Confirmed",
      body: "Your roadside assistance request has been confirmed.",
    },
    dispatched: {
      title: "Help is on the way!",
      body: "A provider has been dispatched to your location.",
    },
    in_progress: {
      title: "Service in Progress",
      body: "Your service is now underway.",
    },
    completed: {
      title: "Service Complete",
      body: "Your service has been completed. Thank you for choosing RoadSide ATL!",
    },
    cancelled: {
      title: "Booking Cancelled",
      body: "Your booking has been cancelled.",
    },
  };

  const message = statusMessages[status];
  if (!message) return;

  await sendPushNotification(userId, {
    ...message,
    url: `/track/${bookingId}`,
    tag: `booking-${bookingId}`,
  });
}

/**
 * Send notification to provider about new job
 */
export async function notifyProviderNewJobPush(
  providerId: string,
  bookingId: string,
  customerName: string,
  serviceName: string
): Promise<void> {
  // Get user ID from provider
  const { providers } = await import("@/db/schema");
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
  });

  if (!provider?.userId) return;

  await sendPushNotification(provider.userId, {
    title: "New Job Assigned",
    body: `${serviceName} for ${customerName}`,
    url: `/provider/jobs`,
    tag: `job-${bookingId}`,
  });
}
