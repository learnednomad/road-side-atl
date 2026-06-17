import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "@/db";
import { providers, providerPayouts, bookings } from "@/db/schema";
import { providerInviteTokens } from "@/db/schema/auth";
import { users } from "@/db/schema/users";
import { onboardingSteps } from "@/db/schema/onboarding-steps";
import { eq, desc, asc, sql, count, and, or, inArray, ilike } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { rateLimitStrict } from "../middleware/rate-limit";
import { createProviderSchema, updateProviderSchema, betaInviteSchema, adminRejectProviderSchema, adminSuspendProviderSchema, adminReviewStepSchema, adminDocumentReviewSchema } from "@/lib/validators";
import { geocodeAddress } from "@/lib/geocoding";
import { isValidProviderTransition, isValidStepTransition } from "../lib/onboarding-state-machine";
import { broadcastToUser, broadcastToAdmins } from "@/server/websocket/broadcast";
import { notifyProviderRejected, notifyDocumentReviewed, notifyAdminProviderReadyForReview } from "@/lib/notifications";
import { triggerNovu, WF, provSub } from "@/lib/notifications/novu";
import { sendEmail } from "@/lib/notifications/email";
import { getPresignedUrl } from "@/lib/s3";
import { providerDocuments } from "@/db/schema/provider-documents";
import {
  createProviderInviteToken,
  sendProviderInviteEmail,
  sendBetaInviteEmail,
} from "@/lib/auth/provider-invite";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import { encrypt, decrypt } from "../lib/encryption";
import { generateCSV } from "@/lib/csv";
import { PROVIDER_STATUSES, IRS_1099_THRESHOLD_CENTS, CHECKR_DASHBOARD_BASE_URL, PRESIGNED_DOWNLOAD_EXPIRY_ADMIN } from "@/lib/constants";
import { logger } from "@/lib/logger";
import type { ProviderStatus } from "@/lib/constants";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);

const providerStatusValues = new Set(PROVIDER_STATUSES);
function isProviderStatus(value: string): value is ProviderStatus {
  return providerStatusValues.has(value as ProviderStatus);
}

// Rate limit sensitive tax ID operations
app.use("/:id/tax-id", rateLimitStrict);

// 1099 CSV export
app.get("/1099-export", async (c) => {
  const yearStr = c.req.query("year") || new Date().getFullYear().toString();
  const year = parseInt(yearStr);
  if (isNaN(year) || year < 2020 || year > 2100) {
    return c.json({ error: "Invalid year" }, 400);
  }

  const yearStart = new Date(`${year}-01-01T00:00:00Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00Z`);

  const earnings = await db
    .select({
      providerId: providerPayouts.providerId,
      providerName: providers.name,
      userId: providers.userId,
      totalEarnings: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
    })
    .from(providerPayouts)
    .innerJoin(providers, eq(providerPayouts.providerId, providers.id))
    .where(and(
      sql`${providerPayouts.createdAt} >= ${yearStart.toISOString()}`,
      sql`${providerPayouts.createdAt} < ${yearEnd.toISOString()}`,
      eq(providerPayouts.payoutType, "standard"),
    ))
    .groupBy(providerPayouts.providerId, providers.name, providers.userId)
    .having(sql`sum(${providerPayouts.amount}) >= ${IRS_1099_THRESHOLD_CENTS}`);

  // Batch-fetch taxIds for qualifying providers (avoid N+1)
  const userIds = earnings.map((r) => r.userId).filter(Boolean) as string[];
  const taxIdMap = new Map<string, string>();
  if (userIds.length > 0) {
    const usersWithTax = await db
      .select({ id: users.id, taxId: users.taxId })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const u of usersWithTax) {
      if (u.taxId) {
        try {
          taxIdMap.set(u.id, decrypt(u.taxId));
        } catch {
          taxIdMap.set(u.id, "DECRYPTION_ERROR");
        }
      }
    }
  }

  const rows: (string | number | null | undefined)[][] = earnings.map((row) => [
    row.providerName,
    row.userId ? taxIdMap.get(row.userId) || "" : "",
    Number(row.totalEarnings),
    year,
  ]);

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "provider.1099_export",
    userId: user.id,
    details: { year, qualifyingProviders: rows.length },
    ipAddress,
    userAgent,
  });

  const csv = generateCSV(
    ["Provider Name", "Tax ID", "Total Earnings (cents)", "Calendar Year"],
    rows,
  );

  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename=1099-export-${year}.csv`);
  c.header("Cache-Control", "no-store");
  return c.body(csv);
});

// 1099 qualifying provider count (for UI preview)
app.get("/1099-count", async (c) => {
  const yearStr = c.req.query("year") || new Date().getFullYear().toString();
  const year = parseInt(yearStr);
  if (isNaN(year) || year < 2020 || year > 2100) {
    return c.json({ error: "Invalid year" }, 400);
  }

  const yearStart = new Date(`${year}-01-01T00:00:00Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00Z`);

  const result = await db
    .select({
      providerCount: sql<number>`count(*)`,
    })
    .from(
      db
        .select({
          providerId: providerPayouts.providerId,
          totalEarnings: sql<number>`sum(${providerPayouts.amount})`,
        })
        .from(providerPayouts)
        .where(and(
          sql`${providerPayouts.createdAt} >= ${yearStart.toISOString()}`,
          sql`${providerPayouts.createdAt} < ${yearEnd.toISOString()}`,
          eq(providerPayouts.payoutType, "standard"),
        ))
        .groupBy(providerPayouts.providerId)
        .having(sql`sum(${providerPayouts.amount}) >= ${IRS_1099_THRESHOLD_CENTS}`)
        .as("qualifying")
    );

  return c.json({ count: Number(result[0]?.providerCount || 0), year });
});

// List providers
app.get("/", async (c) => {
  const status = c.req.query("status");

  let query = db
    .select()
    .from(providers)
    .orderBy(desc(providers.createdAt))
    .$dynamic();

  if (status && isProviderStatus(status)) {
    query = query.where(eq(providers.status, status));
  }

  const results = await query;
  return c.json(results);
});

// Onboarding pipeline view — providers grouped by their current stage.
// MUST be registered before "/:id" so "/pipeline" doesn't match the param route.
// (Restored: the frontend admin pipeline view calls /api/admin/providers/pipeline;
// this route had been lost in a prior file-deletion/restore, 404-ing in prod.)
app.get("/pipeline", async (c) => {
  const search = c.req.query("search");
  const stage = c.req.query("stage");
  const sort = c.req.query("sort");

  let query = db
    .select({
      provider: providers,
      userName: users.name,
      userEmail: users.email,
    })
    .from(providers)
    .leftJoin(users, eq(providers.userId, users.id))
    .where(inArray(providers.status, ["applied", "onboarding", "pending_review"]))
    .$dynamic();

  if (search) {
    // Escape SQL LIKE wildcards to prevent pattern matching abuse
    const escaped = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.where(
      and(
        inArray(providers.status, ["applied", "onboarding", "pending_review"]),
        or(
          ilike(users.name, `%${escaped}%`),
          ilike(users.email, `%${escaped}%`),
          ilike(providers.name, `%${escaped}%`),
          ilike(providers.email, `%${escaped}%`),
        ),
      )
    );
  }

  const providerRows = await query.orderBy(
    sort === "date_asc" ? asc(providers.createdAt) : desc(providers.createdAt)
  );

  // Batch-fetch all onboarding steps in a single query (avoids N+1)
  const providerIds = providerRows.map((r) => r.provider.id);
  const allSteps = providerIds.length > 0
    ? await db.query.onboardingSteps.findMany({
        where: inArray(onboardingSteps.providerId, providerIds),
      })
    : [];
  const stepsByProvider = new Map<string, typeof allSteps>();
  for (const step of allSteps) {
    const existing = stepsByProvider.get(step.providerId) || [];
    existing.push(step);
    stepsByProvider.set(step.providerId, existing);
  }

  const stages: Record<string, unknown[]> = {
    applied: [],
    documents_pending: [],
    background_check: [],
    background_check_review: [],
    stripe_setup: [],
    training: [],
    ready_for_review: [],
  };

  const stepPriority = ["background_check", "insurance", "certifications", "training", "stripe_connect"];

  for (const row of providerRows) {
    const steps = stepsByProvider.get(row.provider.id) || [];

    const completedCount = steps.filter((s) => s.status === "complete").length;
    const providerWithMeta = {
      ...row.provider,
      userName: row.userName,
      userEmail: row.userEmail,
      completedSteps: completedCount,
      totalSteps: steps.length || 5,
    };

    if (row.provider.status === "applied") {
      stages.applied.push(providerWithMeta);
    } else if (row.provider.status === "pending_review") {
      stages.ready_for_review.push(providerWithMeta);
    } else {
      // Check if background_check step is in pending_review (needs admin adjudication)
      const bgStep = steps.find((s) => s.stepType === "background_check");
      if (bgStep?.status === "pending_review") {
        const bgMetadata = (bgStep.metadata || {}) as Record<string, unknown>;
        const checkrReportId = bgMetadata.checkrReportId as string | undefined;
        stages.background_check_review.push({
          ...providerWithMeta,
          checkrReportId: checkrReportId || null,
          checkrDashboardUrl: checkrReportId ? `${CHECKR_DASHBOARD_BASE_URL}/${checkrReportId}` : null,
          backgroundCheckUpdatedAt: bgStep.updatedAt,
        });
      } else {
        const firstIncomplete = stepPriority.find((type) =>
          steps.find((s) => s.stepType === type && s.status !== "complete")
        );

        if (firstIncomplete === "insurance" || firstIncomplete === "certifications") {
          stages.documents_pending.push(providerWithMeta);
        } else if (firstIncomplete === "background_check") {
          stages.background_check.push(providerWithMeta);
        } else if (firstIncomplete === "stripe_connect") {
          stages.stripe_setup.push(providerWithMeta);
        } else if (firstIncomplete === "training") {
          stages.training.push(providerWithMeta);
        } else {
          stages.ready_for_review.push(providerWithMeta);
        }
      }
    }
  }

  if (stage && stages[stage]) {
    return c.json({ stages: { [stage]: stages[stage] }, total: stages[stage].length }, 200);
  }

  const total = Object.values(stages).reduce((sum, arr) => sum + arr.length, 0);
  return c.json({ stages, total }, 200);
});

// Get provider tax ID (decrypted)
app.get("/:id/tax-id", async (c) => {
  const providerId = c.req.param("id");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
    columns: { userId: true },
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);
  if (!provider.userId) return c.json({ taxId: null });

  const user = await db.query.users.findFirst({
    where: eq(users.id, provider.userId),
    columns: { taxId: true },
  });

  let taxIdPlain: string | null = null;
  if (user?.taxId) {
    try {
      taxIdPlain = decrypt(user.taxId);
    } catch {
      taxIdPlain = null;
    }
  }

  const admin = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "provider.view_tax_id",
    userId: admin.id,
    resourceType: "provider",
    resourceId: providerId,
    ipAddress,
    userAgent,
  });

  return c.json({ taxId: taxIdPlain });
});

// Update provider tax ID (encrypted at rest)
const taxIdSchema = z.object({
  taxId: z.string().regex(
    /^(\d{3}-\d{2}-\d{4}|\d{2}-\d{7})$/,
    "Must be SSN (XXX-XX-XXXX) or EIN (XX-XXXXXXX)"
  ),
});

app.put("/:id/tax-id", async (c) => {
  const providerId = c.req.param("id");
  const body = await c.req.json();
  const parsed = taxIdSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
    columns: { userId: true },
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);
  if (!provider.userId) return c.json({ error: "Provider has no linked user account" }, 400);

  const encrypted = encrypt(parsed.data.taxId);
  await db
    .update(users)
    .set({ taxId: encrypted, updatedAt: new Date() })
    .where(eq(users.id, provider.userId));

  const admin = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "provider.update_tax_id",
    userId: admin.id,
    resourceType: "provider",
    resourceId: providerId,
    ipAddress,
    userAgent,
  });

  return c.json({ success: true });
});

// Beta stats — invite counts.
// MUST stay above GET /:id or Hono matches "/beta-stats" as a provider id.
app.get("/beta-stats", async (c) => {
  const [{ count: acceptedInvites }] = await db
    .select({ count: count() })
    .from(providerInviteTokens)
    .where(and(
      eq(providerInviteTokens.inviteType, "beta"),
      eq(providerInviteTokens.status, "accepted"),
    ));

  const [{ count: pendingInvites }] = await db
    .select({ count: count() })
    .from(providerInviteTokens)
    .where(and(
      eq(providerInviteTokens.inviteType, "beta"),
      eq(providerInviteTokens.status, "pending"),
    ));

  return c.json({
    acceptedInvites: Number(acceptedInvites),
    pendingInvites: Number(pendingInvites),
  });
});

// Provider detail + earnings summary
app.get("/:id", async (c) => {
  const providerId = c.req.param("id");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
  });

  if (!provider) {
    return c.json({ error: "Provider not found" }, 404);
  }

  const [earningsSummary] = await db
    .select({
      totalEarned: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      totalPaid: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'paid' then ${providerPayouts.amount} else 0 end), 0)`,
      totalPending: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'pending' then ${providerPayouts.amount} else 0 end), 0)`,
      payoutCount: count(),
    })
    .from(providerPayouts)
    .where(eq(providerPayouts.providerId, providerId));

  return c.json({
    provider,
    earnings: {
      totalEarned: Number(earningsSummary.totalEarned),
      totalPaid: Number(earningsSummary.totalPaid),
      totalPending: Number(earningsSummary.totalPending),
      payoutCount: earningsSummary.payoutCount,
    },
  });
});

// Create provider
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createProviderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  // Geocode address if provided
  let latitude = parsed.data.latitude ?? null;
  let longitude = parsed.data.longitude ?? null;
  if (parsed.data.address && (!latitude || !longitude)) {
    const geocoded = await geocodeAddress(parsed.data.address).catch(() => null);
    if (geocoded) {
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }
  }

  const [provider] = await db
    .insert(providers)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      commissionType: parsed.data.commissionType,
      commissionRate: parsed.data.commissionRate,
      // An explicitly-provided non-default rate is a negotiated arrangement.
      rateIsNegotiated:
        parsed.data.commissionRate !== undefined && parsed.data.commissionRate !== 7000,
      flatFeeAmount: parsed.data.flatFeeAmount ?? null,
      specialties: parsed.data.specialties ?? [],
      status: parsed.data.status ?? "pending",
      latitude,
      longitude,
      address: parsed.data.address ?? null,
    })
    .returning();

  return c.json(provider, 201);
});

// Update provider
app.patch("/:id", async (c) => {
  const providerId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateProviderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const updateData: Partial<typeof providers.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
  if (parsed.data.commissionType !== undefined) updateData.commissionType = parsed.data.commissionType;
  if (parsed.data.commissionRate !== undefined) {
    updateData.commissionRate = parsed.data.commissionRate;
    updateData.rateIsNegotiated = parsed.data.commissionRate !== 7000;
  }
  if (parsed.data.flatFeeAmount !== undefined) updateData.flatFeeAmount = parsed.data.flatFeeAmount;
  if (parsed.data.specialties !== undefined) updateData.specialties = parsed.data.specialties;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.address !== undefined) {
    updateData.address = parsed.data.address;
    if (parsed.data.latitude !== undefined) updateData.latitude = parsed.data.latitude;
    if (parsed.data.longitude !== undefined) updateData.longitude = parsed.data.longitude;
    // Geocode if address provided but no coords
    if (parsed.data.address && !parsed.data.latitude) {
      const geocoded = await geocodeAddress(parsed.data.address).catch(() => null);
      if (geocoded) {
        updateData.latitude = geocoded.latitude;
        updateData.longitude = geocoded.longitude;
      }
    }
  }

  const [updated] = await db
    .update(providers)
    .set(updateData)
    .where(eq(providers.id, providerId))
    .returning();

  if (!updated) {
    return c.json({ error: "Provider not found" }, 404);
  }

  return c.json(updated);
});

// Soft-delete (set inactive)
app.delete("/:id", async (c) => {
  const providerId = c.req.param("id");

  const [updated] = await db
    .update(providers)
    .set({ status: "inactive", updatedAt: new Date() })
    .where(eq(providers.id, providerId))
    .returning();

  if (!updated) {
    return c.json({ error: "Provider not found" }, 404);
  }

  return c.json(updated);
});

// Provider's payout history
app.get("/:id/payouts", async (c) => {
  const providerId = c.req.param("id");

  const payouts = await db
    .select({
      payout: providerPayouts,
      booking: bookings,
    })
    .from(providerPayouts)
    .innerJoin(bookings, eq(providerPayouts.bookingId, bookings.id))
    .where(eq(providerPayouts.providerId, providerId))
    .orderBy(desc(providerPayouts.createdAt));

  return c.json(payouts);
});

// Send invite to provider
app.post("/:id/invite", async (c) => {
  const providerId = c.req.param("id");
  const adminUser = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, providerId),
  });

  if (!provider) {
    return c.json({ error: "Provider not found" }, 404);
  }

  // Check if provider already has a linked user account
  if (provider.userId) {
    return c.json({ error: "Provider already has an account" }, 400);
  }

  // Check if a user with that email already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, provider.email),
  });

  if (existingUser) {
    return c.json(
      { error: "A user with this email already exists" },
      400
    );
  }

  const token = await createProviderInviteToken(
    provider.email,
    adminUser.id,
    { providerId, inviteType: "admin" }
  );

  let deliveryStatus = { emailSent: false, smsSent: false };
  try {
    deliveryStatus = await sendProviderInviteEmail(provider.email, provider.name, token);
  } catch (err) {
    logger.error("Failed to send provider invite:", err);
  }

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "provider.invite",
    userId: adminUser.id,
    resourceType: "provider",
    resourceId: providerId,
    details: { email: provider.email, ...deliveryStatus },
    ipAddress,
    userAgent,
  });

  if (!deliveryStatus.emailSent && !deliveryStatus.smsSent) {
    return c.json({
      success: true,
      warning: "Invite token created but delivery failed. Check that RESEND_API_KEY and Twilio credentials are configured.",
      emailSent: false,
      smsSent: false,
    });
  }

  return c.json({
    success: true,
    message: "Invite sent",
    emailSent: deliveryStatus.emailSent,
    smsSent: deliveryStatus.smsSent,
  });
});

// Get invite status for provider
app.get("/:id/invite-status", async (c) => {
  const providerId = c.req.param("id");

  const [invite] = await db
    .select()
    .from(providerInviteTokens)
    .where(eq(providerInviteTokens.providerId, providerId))
    .orderBy(desc(providerInviteTokens.createdAt))
    .limit(1);

  if (!invite) {
    return c.json({ status: "none" });
  }

  // Check if expired but not yet marked
  if (invite.status === "pending" && new Date() > invite.expires) {
    return c.json({
      status: "expired",
      sentAt: invite.createdAt,
      expiresAt: invite.expires,
    });
  }

  return c.json({
    status: invite.status,
    sentAt: invite.createdAt,
    expiresAt: invite.expires,
    acceptedAt: invite.acceptedAt,
  });
});

// Beta invite — admin sends a beta program invite
app.post("/beta-invite", async (c) => {
  const body = await c.req.json();
  const parsed = betaInviteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  // Check if email already has a pending invite or account
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  });
  if (existingUser) {
    return c.json({ error: "User with this email already exists" }, 400);
  }

  const existingInvite = await db.query.providerInviteTokens.findFirst({
    where: and(
      eq(providerInviteTokens.identifier, parsed.data.email),
      eq(providerInviteTokens.status, "pending"),
    ),
  });
  if (existingInvite) {
    return c.json({ error: "An invite is already pending for this email" }, 400);
  }

  // Create invite token
  const user = c.get("user");
  const token = await createProviderInviteToken(
    parsed.data.email,
    user.id,
    {
      inviteType: "beta",
      name: parsed.data.name,
    }
  );

  // Send beta invite email
  let emailSent = false;
  try {
    const result = await sendBetaInviteEmail(parsed.data.email, parsed.data.name, token);
    emailSent = result.emailSent;
  } catch (err) {
    logger.error("Failed to send beta invite email:", err);
  }

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "provider.invite",
    userId: user.id,
    resourceType: "provider",
    resourceId: "beta-invite",
    details: { email: parsed.data.email, inviteType: "beta", emailSent },
    ipAddress,
    userAgent,
  });

  return c.json({
    success: true,
    inviteType: "beta",
    emailSent,
    ...(!emailSent && { warning: "Invite token created but email delivery failed. Check RESEND_API_KEY configuration." }),
  }, 201);
});


// ── Provider lifecycle management (restored: activate/reject/suspend/reinstate/step-review) ──
app.post("/:id/activate", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  if (!isValidProviderTransition(provider.status, "active")) {
    return c.json({ error: `Invalid transition: ${provider.status} -> active` }, 400);
  }

  const [updated] = await db
    .update(providers)
    .set({
      status: "active",
      activatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(providers.id, id), eq(providers.status, "pending_review")))
    .returning();

  if (!updated) return c.json({ error: "Provider not found or status changed" }, 409);

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "onboarding.activated",
    userId: user.id,
    resourceType: "provider",
    resourceId: id,
    details: { providerName: provider.name },
    ipAddress,
    userAgent,
  });

  if (provider.userId) {
    broadcastToUser(provider.userId, {
      type: "onboarding:activated",
      data: { providerId: id, providerName: provider.name },
    });

    // Fire-and-forget activation notification
    sendEmail({
      to: provider.email,
      subject: "Welcome to RoadSide GA — You're Approved!",
      html: `<p>Hi ${provider.name},</p><p>Your provider application has been approved. You can now accept jobs on the platform.</p>`,
    }).catch((err) => {
      console.error("[Notifications] Failed:", err);
    });
  }

  // Novu: notify provider they are approved
  void triggerNovu(WF.providerApproved, provSub(id), {
    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://roadsidega.com"}/provider/onboarding`,
  });

  return c.json(updated, 200);
});

// Reject provider (pending_review → rejected)
app.post("/:id/reject", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = adminRejectProviderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  if (!isValidProviderTransition(provider.status, "rejected")) {
    return c.json({ error: `Invalid transition: ${provider.status} -> rejected` }, 400);
  }

  const [updated] = await db
    .update(providers)
    .set({
      status: "rejected",
      suspendedReason: parsed.data.reason,
      updatedAt: new Date(),
    })
    .where(and(eq(providers.id, id), eq(providers.status, "pending_review")))
    .returning();

  if (!updated) return c.json({ error: "Provider not found or status changed" }, 409);

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "onboarding.rejected",
    userId: user.id,
    resourceType: "provider",
    resourceId: id,
    details: { reason: parsed.data.reason },
    ipAddress,
    userAgent,
  });

  if (provider.userId) {
    broadcastToUser(provider.userId, {
      type: "onboarding:step_updated",
      data: { providerId: id, stepType: "all", newStatus: "rejected" },
    });

    notifyProviderRejected(id, parsed.data.reason).catch((err) => {
      console.error("[Notifications] Failed:", err);
    });
  }

  return c.json(updated, 200);
});

// Suspend provider (active → suspended)
app.post("/:id/suspend", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = adminSuspendProviderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  if (!isValidProviderTransition(provider.status, "suspended")) {
    return c.json({ error: `Invalid transition: ${provider.status} -> suspended` }, 400);
  }

  const [updated] = await db
    .update(providers)
    .set({
      status: "suspended",
      suspendedAt: new Date(),
      suspendedReason: parsed.data.reason,
      updatedAt: new Date(),
    })
    .where(and(eq(providers.id, id), eq(providers.status, "active")))
    .returning();

  if (!updated) return c.json({ error: "Provider not found or status changed" }, 409);

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "onboarding.suspended",
    userId: user.id,
    resourceType: "provider",
    resourceId: id,
    details: { reason: parsed.data.reason },
    ipAddress,
    userAgent,
  });

  // Novu: notify provider they have been suspended
  void triggerNovu(WF.providerSuspended, provSub(id), { suspendedReason: parsed.data.reason });

  return c.json(updated, 200);
});

// Reinstate provider (suspended → onboarding)
app.post("/:id/reinstate", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  if (!isValidProviderTransition(provider.status, "onboarding")) {
    return c.json({ error: `Invalid transition: ${provider.status} -> onboarding` }, 400);
  }

  // Transaction: update provider + reset rejected steps
  await db.transaction(async (tx) => {
    await tx
      .update(providers)
      .set({
        status: "onboarding",
        suspendedAt: null,
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(providers.id, id));

    // Reset rejected steps to pending (preserve completed steps)
    await tx
      .update(onboardingSteps)
      .set({
        status: "pending",
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        draftData: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(onboardingSteps.providerId, id),
          eq(onboardingSteps.status, "rejected"),
        ),
      );
  });

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "onboarding.status_changed",
    userId: user.id,
    resourceType: "provider",
    resourceId: id,
    details: {
      previousStatus: "suspended",
      newStatus: "onboarding",
      reason: "admin_reinstatement",
    },
    ipAddress,
    userAgent,
  });

  const updated = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });
  return c.json(updated, 200);
});

// Admin review step (PATCH /:id/steps/:stepId)
app.patch("/:id/steps/:stepId", async (c) => {
  const { id, stepId } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = adminReviewStepSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  // Verify step belongs to this provider
  const step = await db.query.onboardingSteps.findFirst({
    where: and(eq(onboardingSteps.id, stepId), eq(onboardingSteps.providerId, id)),
  });
  if (!step) return c.json({ error: "Step not found" }, 404);

  if (!isValidStepTransition(step.status, parsed.data.status)) {
    return c.json({
      error: `Invalid step transition: ${step.status} -> ${parsed.data.status}`,
    }, 400);
  }

  const updateData: Record<string, unknown> = {
    status: parsed.data.status,
    reviewedBy: user.id,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };
  if (parsed.data.status === "complete") {
    updateData.completedAt = new Date();
    updateData.rejectionReason = null;
  }
  if (parsed.data.status === "rejected") {
    updateData.rejectionReason = parsed.data.rejectionReason;
    updateData.completedAt = null;
  }

  const [updated] = await db
    .update(onboardingSteps)
    .set(updateData)
    .where(eq(onboardingSteps.id, stepId))
    .returning();

  const auditAction =
    parsed.data.status === "complete"
      ? "onboarding.step_completed"
      : "onboarding.step_rejected";
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: auditAction,
    userId: user.id,
    resourceType: "onboarding_step",
    resourceId: stepId,
    details: {
      providerId: id,
      stepType: step.stepType,
      newStatus: parsed.data.status,
      ...(parsed.data.rejectionReason && { reason: parsed.data.rejectionReason }),
    },
    ipAddress,
    userAgent,
  });

  // Broadcast WebSocket event
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });
  if (provider?.userId) {
    broadcastToUser(provider.userId, {
      type: "onboarding:step_updated",
      data: {
        providerId: id,
        stepType: step.stepType,
        newStatus: parsed.data.status,
        ...(parsed.data.rejectionReason && {
          rejectionReason: parsed.data.rejectionReason,
        }),
      },
    });
  }

  // Auto-transition check: if approving and all steps now complete
  if (parsed.data.status === "complete" && provider?.status === "onboarding") {
    const allSteps = await db.query.onboardingSteps.findMany({
      where: eq(onboardingSteps.providerId, id),
    });
    const allComplete = allSteps.every((s) =>
      s.id === stepId ? true : s.status === "complete",
    );
    if (allComplete) {
      const [transitioned] = await db
        .update(providers)
        .set({ status: "pending_review", updatedAt: new Date() })
        .where(and(eq(providers.id, id), eq(providers.status, "onboarding")))
        .returning();

      if (transitioned) {
        logAudit({
          action: "onboarding.status_changed",
          userId: "system",
          resourceType: "provider",
          resourceId: id,
          details: {
            previousStatus: "onboarding",
            newStatus: "pending_review",
            trigger: "all_steps_complete",
          },
          ipAddress,
          userAgent,
        });
      }
    }
  }

  return c.json(updated, 200);
});


// ── Provider document review (restored: list + approve/reject documents) ──
app.get("/:id/documents", async (c) => {
  const { id } = c.req.param();

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const docs = await db.query.providerDocuments.findMany({
    where: eq(providerDocuments.providerId, id),
    orderBy: [desc(providerDocuments.createdAt)],
  });

  // Generate presigned download URLs for each document
  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      downloadUrl: await getPresignedUrl(doc.s3Key, PRESIGNED_DOWNLOAD_EXPIRY_ADMIN),
    }))
  );

  // Group by document type
  const grouped = docsWithUrls.reduce((acc, doc) => {
    const type = doc.documentType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, typeof docsWithUrls>);

  return c.json({ documents: grouped }, 200);
});

// PATCH /:id/documents/:documentId — admin approve or reject a document
app.patch("/:id/documents/:documentId", async (c) => {
  const { id, documentId } = c.req.param();
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = adminDocumentReviewSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);

  const doc = await db.query.providerDocuments.findFirst({
    where: and(eq(providerDocuments.id, documentId), eq(providerDocuments.providerId, id)),
  });
  if (!doc) return c.json({ error: "Document not found" }, 404);
  if (doc.status !== "pending_review") {
    return c.json({ error: `Cannot review document with status: ${doc.status}` }, 400);
  }

  const updateData: Record<string, unknown> = {
    status: parsed.data.status,
    reviewedBy: user.id,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };
  if (parsed.data.status === "rejected") {
    updateData.rejectionReason = parsed.data.rejectionReason;
  }
  if (parsed.data.status === "approved") {
    updateData.rejectionReason = null;
  }

  // TOCTOU guard: only update if still pending_review (prevents concurrent double-review)
  const [updated] = await db.update(providerDocuments)
    .set(updateData)
    .where(and(eq(providerDocuments.id, documentId), eq(providerDocuments.status, "pending_review")))
    .returning();

  if (!updated) {
    return c.json({ error: "Document was already reviewed" }, 409);
  }

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  const auditAction = parsed.data.status === "approved" ? "document.approved" : "document.rejected";
  logAudit({
    action: auditAction,
    userId: user.id,
    resourceType: "provider_document",
    resourceId: documentId,
    details: {
      providerId: id,
      documentType: doc.documentType,
      ...(parsed.data.rejectionReason && { reason: parsed.data.rejectionReason }),
    },
    ipAddress,
    userAgent,
  });

  // Broadcast WebSocket event to provider
  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  if (provider?.userId) {
    broadcastToUser(provider.userId, {
      type: "onboarding:document_reviewed",
      data: {
        providerId: id,
        documentType: doc.documentType,
        status: parsed.data.status,
        ...(parsed.data.rejectionReason && { rejectionReason: parsed.data.rejectionReason }),
      },
    });
  }

  // Fire-and-forget notification
  notifyDocumentReviewed(provider?.userId ?? undefined, doc.documentType, parsed.data.status, parsed.data.rejectionReason ?? undefined)
    .catch((err) => { console.error("[Notifications] Failed:", err); });

  // Auto-complete check: if all docs for this step are now approved
  if (parsed.data.status === "approved") {
    const stepDocs = await db.query.providerDocuments.findMany({
      where: and(
        eq(providerDocuments.onboardingStepId, doc.onboardingStepId),
        eq(providerDocuments.providerId, id),
      ),
    });
    const allApproved = stepDocs.every((d) =>
      d.id === documentId ? true : d.status === "approved"
    );
    if (allApproved) {
      const step = await db.query.onboardingSteps.findFirst({
        where: eq(onboardingSteps.id, doc.onboardingStepId),
      });
      if (step && isValidStepTransition(step.status, "complete")) {
        await db.update(onboardingSteps).set({
          status: "complete",
          completedAt: new Date(),
          reviewedBy: user.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(onboardingSteps.id, doc.onboardingStepId));

        logAudit({
          action: "onboarding.step_completed",
          userId: user.id,
          resourceType: "onboarding_step",
          resourceId: doc.onboardingStepId,
          details: { providerId: id, stepType: step.stepType, trigger: "all_documents_approved" },
          ipAddress,
          userAgent,
        });

        // Run all-steps-complete auto-transition check
        if (provider?.status === "onboarding") {
          const allSteps = await db.query.onboardingSteps.findMany({
            where: eq(onboardingSteps.providerId, id),
          });
          const allComplete = allSteps.every((s) =>
            s.id === doc.onboardingStepId ? true : s.status === "complete"
          );
          if (allComplete) {
            const [transitioned] = await db.update(providers).set({
              status: "pending_review",
              updatedAt: new Date(),
            }).where(and(eq(providers.id, id), eq(providers.status, "onboarding"))).returning();

            if (transitioned) {
              broadcastToAdmins({
                type: "onboarding:ready_for_review",
                data: { providerId: id, providerName: provider.name },
              });

              notifyAdminProviderReadyForReview(id, provider.name || "").catch((err) => {
                console.error("[Notifications] Failed:", err);
              });

              logAudit({
                action: "onboarding.status_changed",
                userId: user.id,
                resourceType: "provider",
                resourceId: id,
                details: {
                  previousStatus: "onboarding",
                  newStatus: "pending_review",
                  trigger: "all_steps_complete",
                },
              ipAddress,
              userAgent,
            });
            }
          }
        }
      }
    }
  }

  return c.json(updated, 200);
});

export default app;
