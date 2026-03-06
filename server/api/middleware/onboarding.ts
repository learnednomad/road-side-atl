import { createMiddleware } from "hono/factory";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit } from "@/server/api/lib/audit-logger";

/**
 * Middleware that gates dispatch-related provider routes.
 * Providers must have status "active" (or a valid migration bypass) to access
 * jobs, earnings, stats, and invoices.
 *
 * Self-contained: resolves auth independently so it can be applied at the
 * index.ts level before route modules run their own requireProvider.
 */
export const requireOnboardingComplete = createMiddleware(async (c, next) => {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "provider") {
    // Not a provider — let downstream middleware handle auth errors
    return next();
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, session.user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider not found" }, 404);
  }

  if (provider.status === "active") {
    return next();
  }

  // Check migration bypass
  if (provider.migrationBypassExpiresAt && provider.migrationBypassExpiresAt > new Date()) {
    logAudit({
      action: "onboarding.migration_bypass",
      userId: session.user.id,
      resourceType: "provider",
      resourceId: provider.id,
      details: { bypassExpiresAt: provider.migrationBypassExpiresAt.toISOString() },
    });
    return next();
  }

  return c.json(
    { error: "Onboarding not complete", redirect: "/provider/onboarding" },
    403,
  );
});
