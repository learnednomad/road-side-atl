import { Hono } from "hono";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// Get VAPID public key
app.get("/vapid-public-key", (c) => {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    return c.json({ error: "Push notifications not configured" }, 503);
  }
  return c.json({ publicKey: key });
});

// Subscribe to push notifications
app.post("/subscribe", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid subscription data" }, 400);
  }

  const { endpoint, keys } = parsed.data;
  const userAgent = c.req.header("user-agent") || null;

  // Check if subscription already exists
  const existing = await db.query.pushSubscriptions.findFirst({
    where: eq(pushSubscriptions.endpoint, endpoint),
  });

  if (existing) {
    // Update existing subscription
    await db
      .update(pushSubscriptions)
      .set({
        userId: user.id,
        keys,
        userAgent,
        updatedAt: new Date(),
      })
      .where(eq(pushSubscriptions.id, existing.id));

    return c.json({ success: true, updated: true });
  }

  // Create new subscription
  await db.insert(pushSubscriptions).values({
    userId: user.id,
    endpoint,
    keys,
    userAgent,
  });

  return c.json({ success: true, created: true });
});

// Unsubscribe from push notifications
app.post("/unsubscribe", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const { endpoint } = body;
  if (!endpoint) {
    return c.json({ error: "Endpoint is required" }, 400);
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint))
    );

  return c.json({ success: true });
});

// Check subscription status
app.get("/status", requireAuth, async (c) => {
  const user = c.get("user");

  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, user.id),
  });

  return c.json({
    subscribed: subscriptions.length > 0,
    subscriptionCount: subscriptions.length,
  });
});

// Handle resubscription (from service worker)
app.post("/resubscribe", async (c) => {
  const body = await c.req.json();
  const { oldEndpoint, newSubscription } = body;

  if (oldEndpoint) {
    // Find and update the old subscription
    const old = await db.query.pushSubscriptions.findFirst({
      where: eq(pushSubscriptions.endpoint, oldEndpoint),
    });

    if (old && newSubscription) {
      await db
        .update(pushSubscriptions)
        .set({
          endpoint: newSubscription.endpoint,
          keys: {
            p256dh: newSubscription.keys.p256dh,
            auth: newSubscription.keys.auth,
          },
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, old.id));
    }
  }

  return c.json({ success: true });
});

export default app;
