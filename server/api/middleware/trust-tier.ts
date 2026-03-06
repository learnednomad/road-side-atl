import { createMiddleware } from "hono/factory";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAudit, getRequestInfo } from "@/server/api/lib/audit-logger";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

export const validatePaymentMethod = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get("user");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { trustTier: true },
  });

  if (!dbUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (dbUser.trustTier === 1) {
    const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

    logAudit({
      action: "trust_tier.bypass_attempt",
      userId: user.id,
      resourceType: "payment",
      details: {
        attemptedMethod: "stripe",
        trustTier: 1,
        endpoint: c.req.path,
      },
      ipAddress,
      userAgent,
    });

    return c.json({ error: "Trust Tier 1 users cannot use card payments" }, 400);
  }

  await next();
});
