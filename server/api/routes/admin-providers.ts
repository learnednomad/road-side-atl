import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "@/db";
import { providers, providerPayouts, bookings } from "@/db/schema";
import { providerInviteTokens } from "@/db/schema/auth";
import { users } from "@/db/schema/users";
import { eq, desc, sql, count, and, inArray } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { rateLimitStrict } from "../middleware/rate-limit";
import { createProviderSchema, updateProviderSchema } from "@/lib/validators";
import { geocodeAddress } from "@/lib/geocoding";
import {
  createProviderInviteToken,
  sendProviderInviteEmail,
} from "@/lib/auth/provider-invite";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import { encrypt, decrypt } from "../lib/encryption";
import { generateCSV } from "@/lib/csv";
import { PROVIDER_STATUSES, IRS_1099_THRESHOLD_CENTS } from "@/lib/constants";
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
  if (parsed.data.commissionRate !== undefined) updateData.commissionRate = parsed.data.commissionRate;
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
    providerId,
    adminUser.id
  );

  await sendProviderInviteEmail(provider.email, provider.name, token).catch(
    (err) => {
      console.error("Failed to send provider invite email:", err);
    }
  );

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "provider.invite",
    userId: adminUser.id,
    resourceType: "provider",
    resourceId: providerId,
    details: { email: provider.email },
    ipAddress,
    userAgent,
  });

  return c.json({ success: true, message: "Invite sent" });
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

export default app;
