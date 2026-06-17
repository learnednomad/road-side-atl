import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema/providers";
import { requireAuth } from "../middleware/auth";
import { isNovuEnabled, inboxSubscriberHash, custSub, provSub } from "@/lib/notifications/novu";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

/**
 * Returns the config the front-end <Inbox> needs for the logged-in user:
 * the subscriberId for their role plus the HMAC subscriberHash that proves
 * to Novu they may read that subscriber's feed. The secret key never leaves
 * the server. Returns { enabled:false } when Novu is turned off so the client
 * can hide the bell.
 */
app.get("/inbox-config", requireAuth, async (c) => {
  const user = c.get("user");
  if (!isNovuEnabled()) return c.json({ enabled: false });

  // Providers' subscribers are keyed by provider id; resolve it for provider users.
  let subscriberId = custSub(user.id);
  if (user.role === "provider") {
    const prov = await db.query.providers.findFirst({ where: eq(providers.userId, user.id) });
    if (prov) subscriberId = provSub(prov.id);
  }

  const subscriberHash = inboxSubscriberHash(subscriberId);
  return c.json({
    enabled: true,
    subscriberId,
    subscriberHash,
    applicationIdentifier: process.env.NEXT_PUBLIC_NOVU_APP_ID ?? "",
    backendUrl: process.env.NEXT_PUBLIC_NOVU_BACKEND_URL ?? "https://novu-api.roadsidega.com",
    socketUrl: process.env.NEXT_PUBLIC_NOVU_SOCKET_URL ?? "https://novu-ws.roadsidega.com",
  });
});

export default app;
