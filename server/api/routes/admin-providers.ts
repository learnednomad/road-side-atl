import { Hono } from "hono";
import { db } from "@/db";
import { providers, providerPayouts, bookings, payments } from "@/db/schema";
import { providerInviteTokens } from "@/db/schema/auth";
import { users } from "@/db/schema/users";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { createProviderSchema, updateProviderSchema } from "@/lib/validators";
import { geocodeAddress } from "@/lib/geocoding";
import {
  createProviderInviteToken,
  sendProviderInviteEmail,
} from "@/lib/auth/provider-invite";
import { logAudit, getRequestInfo } from "../lib/audit-logger";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);

// List providers
app.get("/", async (c) => {
  const status = c.req.query("status");

  let query = db
    .select()
    .from(providers)
    .orderBy(desc(providers.createdAt))
    .$dynamic();

  if (status) {
    query = query.where(eq(providers.status, status as any));
  }

  const results = await query;
  return c.json(results);
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

  const updateData: Record<string, any> = { updatedAt: new Date() };
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
