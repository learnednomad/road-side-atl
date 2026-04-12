import { Hono } from "hono";
import { db } from "@/db";
import { bookings, services, providers, payments, providerPayouts, users, dispatchLogs } from "@/db/schema";
import { eq, desc, and, count, sql, inArray } from "drizzle-orm";
import { requireProvider } from "../middleware/auth";
import { BOOKING_STATUSES } from "@/lib/constants";
import type { BookingStatus } from "@/lib/constants";
import { updateBookingStatusSchema } from "@/lib/validators";
import { notifyStatusChange, notifyReferralLink } from "@/lib/notifications";
import { broadcastToAdmins, broadcastToUser } from "@/server/websocket/broadcast";
import { dispatchBooking } from "../lib/dispatch-router";
import { geocodeAddress } from "@/lib/geocoding";
import { generateReferralCode, creditReferralOnFirstBooking, creditProviderReferralOnFirstJob } from "../lib/referral-credits";
import { calculateEtaMinutes } from "../lib/eta-calculator";
import { logAudit } from "../lib/audit-logger";
import { logger } from "@/lib/logger";
import { getStripe } from "@/lib/stripe";
import { sendDelayNotificationSMS } from "@/lib/notifications/sms";
import { ETA_DELAY_THRESHOLD_MINUTES } from "@/lib/constants";
import { markDelayNotified, hasDelayNotification, clearDelayNotification } from "../lib/delay-tracker";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireProvider);

// Get provider's assigned jobs
app.get("/jobs", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  // Find provider record linked to this user
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const conditions = [eq(bookings.providerId, provider.id)];
  if (status && BOOKING_STATUSES.includes(status as BookingStatus)) {
    conditions.push(eq(bookings.status, status as BookingStatus));
  }

  const [totalResult] = await db
    .select({ count: count() })
    .from(bookings)
    .where(and(...conditions));

  const jobs = await db
    .select({
      booking: bookings,
      service: services,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(...conditions))
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    data: jobs,
    total: totalResult.count,
    page,
    limit,
    totalPages: Math.ceil(totalResult.count / limit),
    providerId: provider.id,
  });
});

// Get single job detail
app.get("/jobs/:id", async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)),
  });

  if (!booking) {
    return c.json({ error: "Job not found" }, 404);
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  const bookingPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, bookingId));

  return c.json({ booking, service, payments: bookingPayments });
});

// Accept assignment
app.patch("/jobs/:id/accept", async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)),
  });

  if (!booking) {
    return c.json({ error: "Job not found" }, 404);
  }

  if (booking.status !== "dispatched" && booking.status !== "confirmed") {
    return c.json({ error: "Job cannot be accepted in current status" }, 400);
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: "in_progress", offerExpiresAt: null, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  // Fire-and-forget notifications
  notifyStatusChange(booking, "in_progress").catch(() => {});
  broadcastToAdmins({ type: "booking:status_changed", data: { bookingId, status: "in_progress" } });
  if (booking.userId) {
    broadcastToUser(booking.userId, { type: "booking:status_changed", data: { bookingId, status: "in_progress" } });
  }

  return c.json(updated);
});

// Reject assignment (unassign, trigger re-dispatch)
app.patch("/jobs/:id/reject", async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)),
  });

  if (!booking) {
    return c.json({ error: "Job not found" }, 404);
  }

  if (booking.status !== "dispatched") {
    return c.json({ error: "Job can only be rejected when dispatched" }, 400);
  }

  // Unassign provider and revert to confirmed
  const [updated] = await db
    .update(bookings)
    .set({ providerId: null, status: "confirmed", offerExpiresAt: null, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  // Log rejection outcome
  await db.insert(dispatchLogs).values({
    bookingId,
    assignedProviderId: provider.id,
    algorithm: "auto",
    reason: `Provider ${provider.name} rejected the offer`,
    attemptNumber: booking.dispatchAttempt || 1,
    outcome: "rejected",
  });

  // Build exclusion list from previous dispatch attempts, then re-dispatch
  const previousDispatches = await db.query.dispatchLogs.findMany({
    where: eq(dispatchLogs.bookingId, bookingId),
  });
  const excludeProviderIds = previousDispatches
    .filter((d) => d.assignedProviderId)
    .map((d) => d.assignedProviderId!);
  dispatchBooking(bookingId, {
    excludeProviderIds,
    attempt: (booking.dispatchAttempt || 0) + 1,
  }).catch(() => {});

  broadcastToAdmins({ type: "booking:status_changed", data: { bookingId, status: "confirmed" } });
  if (booking.userId) {
    broadcastToUser(booking.userId, { type: "booking:status_changed", data: { bookingId, status: "confirmed" } });
  }

  return c.json(updated);
});

// Update job status
app.patch("/jobs/:id/status", async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateBookingStatusSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)),
  });

  if (!booking) {
    return c.json({ error: "Job not found" }, 404);
  }

  const VALID_PROVIDER_TRANSITIONS: Record<string, string[]> = {
    dispatched: ["in_progress"],
    in_progress: ["completed"],
    confirmed: ["cancelled"],
  };
  const allowedNext = VALID_PROVIDER_TRANSITIONS[booking.status];
  if (!allowedNext || !allowedNext.includes(parsed.data.status)) {
    return c.json({ error: `Invalid status transition from ${booking.status} to ${parsed.data.status}` }, 400);
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  notifyStatusChange(booking, parsed.data.status).catch(() => {});
  broadcastToAdmins({ type: "booking:status_changed", data: { bookingId, status: parsed.data.status } });
  if (booking.userId) {
    broadcastToUser(booking.userId, { type: "booking:status_changed", data: { bookingId, status: parsed.data.status } });
  }

  if (parsed.data.status === "completed" || parsed.data.status === "cancelled") {
    if (booking.providerId) {
      db.update(providers)
        .set({ currentLocation: null, lastLocationUpdate: null, updatedAt: new Date() })
        .where(eq(providers.id, booking.providerId))
        .catch(() => {});
    }
    clearDelayNotification(bookingId);
  }

  // Post-service referral SMS on completion (fire-and-forget) — only if payment confirmed
  if (parsed.data.status === "completed" && booking.contactPhone && booking.userId) {
    const confirmedPayment = await db.query.payments.findFirst({
      where: and(eq(payments.bookingId, bookingId), eq(payments.status, "confirmed")),
    });

    if (confirmedPayment) {
      (async () => {
        const bookingUser = await db.query.users.findFirst({
          where: eq(users.id, booking.userId!),
        });
        if (bookingUser) {
          let referralCode = bookingUser.referralCode;
          if (!referralCode) {
            referralCode = await generateReferralCode(bookingUser.id);
          }
          const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || ""}/register?ref=${referralCode}`;
          notifyReferralLink(booking.contactPhone, referralLink).catch(() => {});
        }
      })().catch(() => {});
    }

    // Credit referral on first booking completion (fire-and-forget)
    (async () => {
      await creditReferralOnFirstBooking(booking.userId!, bookingId);
    })().catch(() => {});
  }

  // Provider referral reward on first completed job (fire-and-forget)
  if (parsed.data.status === "completed" && booking.providerId) {
    creditProviderReferralOnFirstJob(booking.providerId, bookingId).catch((err) => {
      logger.error("[Notifications] Failed:", err);
    });
  }

  return c.json(updated);
});

// Update current location
app.post("/location", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { latitude, longitude } = body;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return c.json({ error: "Invalid coordinates" }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  await db
    .update(providers)
    .set({
      currentLocation: { lat: latitude, lng: longitude, updatedAt: new Date().toISOString() },
      lastLocationUpdate: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(providers.id, provider.id));

  broadcastToAdmins({
    type: "provider:location_updated",
    data: { providerId: provider.id, lat: latitude, lng: longitude },
  });

  const activeBookings = await db.query.bookings.findMany({
    where: and(
      eq(bookings.providerId, provider.id),
      inArray(bookings.status, ["dispatched", "in_progress"])
    ),
  });

  for (const activeBooking of activeBookings) {
    const pickupLat = activeBooking.location?.latitude;
    const pickupLng = activeBooking.location?.longitude;

    let etaMinutes: number | undefined;
    if (pickupLat && pickupLng) {
      etaMinutes = calculateEtaMinutes(latitude, longitude, pickupLat, pickupLng);
    }

    broadcastToUser(activeBooking.id, {
      type: "provider:location_updated",
      data: { providerId: provider.id, lat: latitude, lng: longitude, etaMinutes },
    });

    if (
      etaMinutes &&
      etaMinutes > ETA_DELAY_THRESHOLD_MINUTES &&
      !hasDelayNotification(activeBooking.id) &&
      activeBooking.contactPhone
    ) {
      markDelayNotified(activeBooking.id);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
      const trackingUrl = `${baseUrl}/track/${activeBooking.id}`;
      sendDelayNotificationSMS(activeBooking.contactPhone, provider.name, etaMinutes, trackingUrl).catch(() => {});
      logAudit({
        action: "booking.delay_notification",
        userId: user.id,
        resourceType: "booking",
        resourceId: activeBooking.id,
        details: { etaMinutes, providerLat: latitude, providerLng: longitude },
      }).catch(() => {});
    }
  }

  return c.json({ success: true });
});

// Provider stats
app.get("/stats", async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [todayJobs] = await db
    .select({ count: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.providerId, provider.id),
        eq(bookings.status, "completed"),
        sql`${bookings.updatedAt} >= ${todayStart.toISOString()}`
      )
    );

  const [weekEarnings] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .where(
      and(
        eq(bookings.providerId, provider.id),
        eq(payments.status, "confirmed"),
        sql`${payments.createdAt} >= ${weekStart.toISOString()}`
      )
    );

  const [totalCompleted] = await db
    .select({ count: count() })
    .from(bookings)
    .where(
      and(eq(bookings.providerId, provider.id), eq(bookings.status, "completed"))
    );

  return c.json({
    todayJobs: todayJobs.count,
    weekEarnings: Number(weekEarnings.total),
    totalCompleted: totalCompleted.count,
  });
});

// Get provider profile
app.get("/profile", async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  return c.json({
    id: provider.id,
    name: provider.name,
    email: provider.email,
    phone: provider.phone,
    address: provider.address,
    latitude: provider.latitude,
    longitude: provider.longitude,
    isAvailable: provider.isAvailable,
    commissionRate: provider.commissionRate,
    commissionType: provider.commissionType,
    flatFeeAmount: provider.flatFeeAmount,
    specialties: provider.specialties,
    status: provider.status,
  });
});

// Update provider profile
app.patch("/profile", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const updates: Partial<{
    name: string;
    phone: string;
    address: string;
    latitude: number;
    longitude: number;
    serviceAreas: string[];
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (body.name && typeof body.name === "string") updates.name = body.name;
  if (body.phone && typeof body.phone === "string") updates.phone = body.phone;
  if (body.address && typeof body.address === "string") updates.address = body.address;
  if (typeof body.latitude === "number") updates.latitude = body.latitude;
  if (typeof body.longitude === "number") updates.longitude = body.longitude;
  if (Array.isArray(body.serviceAreas)) updates.serviceAreas = body.serviceAreas;

  // Geocode if address provided without coordinates
  if (updates.address && !updates.latitude && !updates.longitude) {
    const geocoded = await geocodeAddress(updates.address).catch(() => null);
    if (geocoded) {
      updates.latitude = geocoded.latitude;
      updates.longitude = geocoded.longitude;
    }
  }

  const [updated] = await db
    .update(providers)
    .set(updates)
    .where(eq(providers.id, provider.id))
    .returning();

  return c.json(updated);
});

// Toggle availability
app.patch("/availability", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const isAvailable = body.isAvailable;

  if (typeof isAvailable !== "boolean") {
    return c.json({ error: "isAvailable must be a boolean" }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const [updated] = await db
    .update(providers)
    .set({ isAvailable, updatedAt: new Date() })
    .where(eq(providers.id, provider.id))
    .returning();

  return c.json(updated);
});

// Earnings summary
app.get("/earnings/summary", async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [earningsSummary] = await db
    .select({
      totalEarned: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      pendingPayout: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'pending' then ${providerPayouts.amount} else 0 end), 0)`,
      paidOut: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'paid' then ${providerPayouts.amount} else 0 end), 0)`,
    })
    .from(providerPayouts)
    .where(eq(providerPayouts.providerId, provider.id));

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((todayStart.getDay() + 6) % 7));

  const [[monthEarnings], [todayEarnings], [weekEarnings]] = await Promise.all([
    db
      .select({
        thisMonth: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
        completedJobs: sql<number>`count(*)`,
      })
      .from(providerPayouts)
      .where(
        and(
          eq(providerPayouts.providerId, provider.id),
          eq(providerPayouts.payoutType, "standard"),
          sql`${providerPayouts.createdAt} >= ${monthStart.toISOString()}`
        )
      ),
    db
      .select({
        total: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
        jobCount: sql<number>`count(*)`,
      })
      .from(providerPayouts)
      .where(
        and(
          eq(providerPayouts.providerId, provider.id),
          eq(providerPayouts.payoutType, "standard"),
          sql`${providerPayouts.createdAt} >= ${todayStart.toISOString()}`
        )
      ),
    db
      .select({
        total: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
        jobCount: sql<number>`count(*)`,
      })
      .from(providerPayouts)
      .where(
        and(
          eq(providerPayouts.providerId, provider.id),
          eq(providerPayouts.payoutType, "standard"),
          sql`${providerPayouts.createdAt} >= ${weekStart.toISOString()}`
        )
      ),
  ]);

  // Fetch per-service commission rates for provider visibility
  const serviceRates = await db
    .select({
      name: services.name,
      category: services.category,
      commissionRate: services.commissionRate,
    })
    .from(services)
    .where(eq(services.active, true))
    .orderBy(services.category, services.name);

  return c.json({
    totalEarned: Number(earningsSummary.totalEarned),
    pendingPayout: Number(earningsSummary.pendingPayout),
    paidOut: Number(earningsSummary.paidOut),
    thisMonthEarnings: Number(monthEarnings.thisMonth),
    completedJobsThisMonth: Number(monthEarnings.completedJobs),
    todayEarnings: Number(todayEarnings.total),
    todayJobCount: Number(todayEarnings.jobCount),
    thisWeekEarnings: Number(weekEarnings.total),
    thisWeekJobCount: Number(weekEarnings.jobCount),
    commissionRate: provider.commissionRate,
    commissionType: provider.commissionType,
    flatFeeAmount: provider.flatFeeAmount,
    serviceCommissionRates: serviceRates.map((s) => ({
      name: s.name,
      category: s.category,
      platformCommissionPercent: s.commissionRate / 100,
      providerSharePercent: (10000 - s.commissionRate) / 100,
    })),
  });
});

// Earnings history (payout list)
app.get("/earnings/history", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const conditions = [eq(providerPayouts.providerId, provider.id)];
  if (status && (status === "pending" || status === "paid")) {
    conditions.push(eq(providerPayouts.status, status));
  }

  const [totalResult] = await db
    .select({ count: count() })
    .from(providerPayouts)
    .where(and(...conditions));

  const results = await db
    .select({
      payout: providerPayouts,
      booking: bookings,
      service: services,
      bookingAmount: sql<number>`(
        SELECT coalesce(p.amount, 0)
        FROM payments p
        WHERE p."bookingId" = ${providerPayouts.bookingId}
        AND p.status = 'confirmed'
        LIMIT 1
      )`,
    })
    .from(providerPayouts)
    .innerJoin(bookings, eq(providerPayouts.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(...conditions))
    .orderBy(desc(providerPayouts.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    data: results.map((r) => {
      const subqueryAmount = Number(r.bookingAmount);
      const bookingAmount = subqueryAmount > 0 ? subqueryAmount : (r.booking.priceOverrideCents ?? r.booking.finalPrice ?? r.booking.estimatedPrice ?? 0);
      const payoutAmount = r.payout.amount;
      return {
        payout: {
          ...r.payout,
          createdAt: r.payout.createdAt.toISOString(),
          paidAt: r.payout.paidAt?.toISOString() || null,
        },
        booking: {
          id: r.booking.id,
          contactName: r.booking.contactName,
          createdAt: r.booking.createdAt.toISOString(),
        },
        service: {
          name: r.service.name,
          category: r.service.category,
          commissionRate: r.service.commissionRate,
          providerSharePercent: (10000 - r.service.commissionRate) / 100,
        },
        bookingAmount,
        commissionDeducted: bookingAmount - payoutAmount,
      };
    }),
    total: totalResult.count,
    page,
    limit,
    totalPages: Math.ceil(totalResult.count / limit),
  });
});

// Daily earnings (last 30 days)
app.get("/earnings/daily", async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider not found" }, 404);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const daily = await db
    .select({
      date: sql<string>`to_char(${providerPayouts.createdAt}, 'YYYY-MM-DD')`,
      earnings: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      jobCount: sql<number>`count(*)`,
    })
    .from(providerPayouts)
    .where(
      and(
        eq(providerPayouts.providerId, provider.id),
        sql`${providerPayouts.createdAt} >= ${thirtyDaysAgo.toISOString()}`,
        eq(providerPayouts.payoutType, "standard"),
      )
    )
    .groupBy(sql`to_char(${providerPayouts.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${providerPayouts.createdAt}, 'YYYY-MM-DD')`);

  return c.json({
    daily: daily.map((d) => ({
      date: d.date,
      earnings: Number(d.earnings),
      jobCount: Number(d.jobCount),
    })),
  });
});

// Weekly earnings (last 12 weeks)
app.get("/earnings/weekly", async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider not found" }, 404);
  }

  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

  const weekly = await db
    .select({
      week: sql<string>`to_char(${providerPayouts.createdAt}, 'IYYY-IW')`,
      weekStart: sql<string>`to_char(date_trunc('week', ${providerPayouts.createdAt}), 'YYYY-MM-DD')`,
      weekEnd: sql<string>`to_char(date_trunc('week', ${providerPayouts.createdAt}) + interval '6 days', 'YYYY-MM-DD')`,
      earnings: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      jobCount: sql<number>`count(*)`,
    })
    .from(providerPayouts)
    .where(
      and(
        eq(providerPayouts.providerId, provider.id),
        sql`${providerPayouts.createdAt} >= ${twelveWeeksAgo.toISOString()}`,
        eq(providerPayouts.payoutType, "standard"),
      )
    )
    .groupBy(
      sql`to_char(${providerPayouts.createdAt}, 'IYYY-IW')`,
      sql`date_trunc('week', ${providerPayouts.createdAt})`,
    )
    .orderBy(sql`to_char(${providerPayouts.createdAt}, 'IYYY-IW')`);

  return c.json({
    weekly: weekly.map((w) => ({
      week: w.week,
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      earnings: Number(w.earnings),
      jobCount: Number(w.jobCount),
    })),
  });
});

// Earnings trends with period support (?period=daily|weekly|monthly)
app.get("/earnings/trends", async (c) => {
  const user = c.get("user");
  const period = c.req.query("period") || "monthly";

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  if (period === "daily") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trends = await db
      .select({
        date: sql<string>`to_char(${providerPayouts.createdAt}, 'YYYY-MM-DD')`,
        earnings: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
        jobCount: sql<number>`count(*)`,
      })
      .from(providerPayouts)
      .where(
        and(
          eq(providerPayouts.providerId, provider.id),
          sql`${providerPayouts.createdAt} >= ${thirtyDaysAgo.toISOString()}`,
          eq(providerPayouts.payoutType, "standard"),
        )
      )
      .groupBy(sql`to_char(${providerPayouts.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${providerPayouts.createdAt}, 'YYYY-MM-DD')`);

    return c.json({
      period: "daily",
      trends: trends.map((t) => ({
        label: t.date,
        earnings: Number(t.earnings),
        jobCount: Number(t.jobCount),
      })),
    });
  }

  if (period === "weekly") {
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const trends = await db
      .select({
        week: sql<string>`to_char(${providerPayouts.createdAt}, 'IYYY-IW')`,
        weekStart: sql<string>`to_char(date_trunc('week', ${providerPayouts.createdAt}), 'YYYY-MM-DD')`,
        earnings: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
        jobCount: sql<number>`count(*)`,
      })
      .from(providerPayouts)
      .where(
        and(
          eq(providerPayouts.providerId, provider.id),
          sql`${providerPayouts.createdAt} >= ${twelveWeeksAgo.toISOString()}`,
          eq(providerPayouts.payoutType, "standard"),
        )
      )
      .groupBy(
        sql`to_char(${providerPayouts.createdAt}, 'IYYY-IW')`,
        sql`date_trunc('week', ${providerPayouts.createdAt})`,
      )
      .orderBy(sql`to_char(${providerPayouts.createdAt}, 'IYYY-IW')`);

    return c.json({
      period: "weekly",
      trends: trends.map((t) => ({
        label: t.week,
        weekStart: t.weekStart,
        earnings: Number(t.earnings),
        jobCount: Number(t.jobCount),
      })),
    });
  }

  // Default: monthly (backward compatible)
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);
  startDate.setDate(1);

  const trends = await db
    .select({
      month: sql<string>`to_char(${providerPayouts.createdAt}, 'YYYY-MM')`,
      earnings: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      jobCount: sql<number>`count(*)`,
    })
    .from(providerPayouts)
    .where(
      and(
        eq(providerPayouts.providerId, provider.id),
        eq(providerPayouts.payoutType, "standard"),
        sql`${providerPayouts.createdAt} >= ${startDate.toISOString()}`
      )
    )
    .groupBy(sql`to_char(${providerPayouts.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${providerPayouts.createdAt}, 'YYYY-MM')`);

  return c.json({
    period: "monthly",
    trends: trends.map((t) => ({
      label: t.month,
      earnings: Number(t.earnings),
      jobCount: Number(t.jobCount),
    })),
  });
});

// Earnings breakdown by service
app.get("/earnings/by-service", async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const breakdown = await db
    .select({
      serviceName: services.name,
      serviceCategory: services.category,
      commissionRate: services.commissionRate,
      earnings: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      jobCount: sql<number>`count(*)`,
    })
    .from(providerPayouts)
    .innerJoin(bookings, eq(providerPayouts.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(providerPayouts.providerId, provider.id))
    .groupBy(services.name, services.category, services.commissionRate);

  return c.json({
    breakdown: breakdown.map((b) => ({
      serviceName: b.serviceName,
      serviceCategory: b.serviceCategory,
      commissionRate: b.commissionRate,
      providerSharePercent: (10000 - b.commissionRate) / 100,
      earnings: Number(b.earnings),
      jobCount: Number(b.jobCount),
    })),
  });
});

// ── Instant Payouts ──────────────────────────────────────────────

// GET /provider/instant-payout/eligibility — check if provider can get instant payouts
app.get("/instant-payout/eligibility", async (c) => {
  const user = c.get("user");
  const { isFeatureEnabled, FEATURE_FLAGS } = await import("../lib/feature-flags");

  if (!(await isFeatureEnabled(FEATURE_FLAGS.INSTANT_PAYOUTS))) {
    return c.json({ eligible: false, reason: "Instant payouts not enabled" });
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
    columns: { id: true, stripeConnectAccountId: true },
  });
  if (!provider?.stripeConnectAccountId) {
    return c.json({ eligible: false, reason: "Stripe Connect account required" });
  }

  try {
    const stripe = (await import("@/lib/stripe")).getStripe();
    const balance = await stripe.balance.retrieve({ stripeAccount: provider.stripeConnectAccountId });
    const availableAmount = balance.instant_available?.reduce((sum, b) => sum + b.amount, 0) ?? 0;

    return c.json({
      eligible: availableAmount > 0,
      availableAmount,
      fee: "1.5%",
      maxPerDay: 10,
    });
  } catch (err) {
    logger.warn("[InstantPayout] Eligibility check failed", { error: err instanceof Error ? err.message : String(err) });
    return c.json({ eligible: false, reason: "Unable to check eligibility" });
  }
});

// POST /provider/instant-payout — trigger instant payout
app.post("/instant-payout", async (c) => {
  const user = c.get("user");
  const { isFeatureEnabled, FEATURE_FLAGS } = await import("../lib/feature-flags");

  if (!(await isFeatureEnabled(FEATURE_FLAGS.INSTANT_PAYOUTS))) {
    return c.json({ error: "Instant payouts not enabled" }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
    columns: { id: true, stripeConnectAccountId: true },
  });
  if (!provider?.stripeConnectAccountId) {
    return c.json({ error: "Stripe Connect account required" }, 400);
  }

  const body = await c.req.json<{ amount?: number }>();

  try {
    const stripe = (await import("@/lib/stripe")).getStripe();
    const balance = await stripe.balance.retrieve({ stripeAccount: provider.stripeConnectAccountId });
    const availableAmount = balance.instant_available?.reduce((sum, b) => sum + b.amount, 0) ?? 0;

    const payoutAmount = body.amount ?? availableAmount;
    if (payoutAmount <= 0 || payoutAmount > availableAmount) {
      return c.json({ error: `Invalid amount. Available: $${(availableAmount / 100).toFixed(2)}` }, 400);
    }

    const payout = await stripe.payouts.create(
      {
        amount: payoutAmount,
        currency: "usd",
        method: "instant",
        metadata: { providerId: provider.id, userId: user.id },
      },
      { stripeAccount: provider.stripeConnectAccountId },
    );

    logAudit({
      action: "payout.create",
      userId: user.id,
      resourceType: "instant_payout",
      resourceId: payout.id,
      details: { amount: payoutAmount, method: "instant", providerId: provider.id },
    });

    return c.json({
      payoutId: payout.id,
      amount: payoutAmount,
      status: payout.status,
      arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
    });
  } catch (err) {
    logger.error("[InstantPayout] Failed", { error: err instanceof Error ? err.message : String(err) });
    return c.json({ error: err instanceof Error ? err.message : "Instant payout failed" }, 500);
  }
});

// ── Payout Schedule Preferences ─────────────────────────────────

// GET /provider/payout-settings — current payout schedule
app.get("/payout-settings", async (c) => {
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
    columns: { id: true, stripeConnectAccountId: true },
  });
  if (!provider?.stripeConnectAccountId) {
    return c.json({ error: "Stripe Connect account required" }, 400);
  }

  try {
    const stripe = (await import("@/lib/stripe")).getStripe();
    const account = await stripe.accounts.retrieve(provider.stripeConnectAccountId);
    const schedule = account.settings?.payouts?.schedule;

    return c.json({
      interval: schedule?.interval ?? "daily",
      weeklyAnchor: schedule?.weekly_anchor ?? null,
      monthlyAnchor: schedule?.monthly_anchor ?? null,
    });
  } catch (err) {
    logger.warn("[PayoutSettings] Failed to retrieve", { error: err instanceof Error ? err.message : String(err) });
    return c.json({ error: "Unable to retrieve payout settings" }, 503);
  }
});

// PUT /provider/payout-settings — update payout schedule
app.put("/payout-settings", async (c) => {
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
    columns: { id: true, stripeConnectAccountId: true },
  });
  if (!provider?.stripeConnectAccountId) {
    return c.json({ error: "Stripe Connect account required" }, 400);
  }

  const body = await c.req.json<{
    interval: "daily" | "weekly" | "monthly";
    weeklyAnchor?: string;
    monthlyAnchor?: number;
  }>();

  if (!["daily", "weekly", "monthly"].includes(body.interval)) {
    return c.json({ error: "Invalid interval. Must be daily, weekly, or monthly" }, 400);
  }

  try {
    const stripe = (await import("@/lib/stripe")).getStripe();
    await stripe.accounts.update(provider.stripeConnectAccountId, {
      settings: {
        payouts: {
          schedule: {
            interval: body.interval,
            ...(body.interval === "weekly" && body.weeklyAnchor ? { weekly_anchor: body.weeklyAnchor as "monday" } : {}),
            ...(body.interval === "monthly" && body.monthlyAnchor ? { monthly_anchor: body.monthlyAnchor } : {}),
          },
        },
      },
    });

    logAudit({
      action: "settings.update",
      userId: user.id,
      resourceType: "payout_schedule",
      resourceId: provider.stripeConnectAccountId,
      details: { interval: body.interval, weeklyAnchor: body.weeklyAnchor, monthlyAnchor: body.monthlyAnchor },
    });

    return c.json({ ok: true, interval: body.interval });
  } catch (err) {
    logger.error("[PayoutSettings] Update failed", { error: err instanceof Error ? err.message : String(err) });
    return c.json({ error: "Unable to update payout schedule" }, 500);
  }
});

// ── Tax Forms (1099-K) ───────────────────────────────────────────

// GET /provider/tax-forms — tax form access via Stripe Express Dashboard
// 1099-K forms are managed by Stripe and accessible through the Express Dashboard.
// This endpoint generates a login link to the tax section.
app.get("/tax-forms", async (c) => {
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
    columns: { id: true, stripeConnectAccountId: true },
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);
  if (!provider.stripeConnectAccountId) {
    return c.json({ error: "Stripe Connect account required for tax forms", dashboardUrl: null }, 400);
  }

  try {
    const loginLink = await getStripe().accounts.createLoginLink(
      provider.stripeConnectAccountId,
    );

    logAudit({
      action: "provider.1099_export",
      userId: user.id,
      resourceType: "tax_form",
      resourceId: provider.stripeConnectAccountId,
      details: { providerId: provider.id },
    });

    return c.json({
      dashboardUrl: loginLink.url,
      message: "Access your 1099-K tax forms through the Stripe Dashboard",
    });
  } catch (err) {
    logger.warn("[TaxForms] Failed to generate dashboard link:", { error: err instanceof Error ? err.message : String(err) });
    return c.json({ error: "Unable to generate tax dashboard link" }, 503);
  }
});

// ── Provider Earnings Dashboard ───────────────────────────────────

// GET /provider/earnings/summary — aggregated earnings
app.get("/earnings/summary", async (c) => {
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
    columns: { id: true },
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [summary] = await db
    .select({
      totalEarnings: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'paid' and ${providerPayouts.payoutType} = 'standard' then ${providerPayouts.amount} else 0 end), 0)`,
      totalPending: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'pending' and ${providerPayouts.payoutType} = 'standard' then ${providerPayouts.amount} else 0 end), 0)`,
      totalHeld: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'held' then ${providerPayouts.amount} else 0 end), 0)`,
      totalClawback: sql<number>`coalesce(sum(case when ${providerPayouts.payoutType} = 'clawback' then abs(${providerPayouts.amount}) else 0 end), 0)`,
      jobCount: sql<number>`count(case when ${providerPayouts.payoutType} = 'standard' then 1 end)`,
      weekEarnings: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'paid' and ${providerPayouts.payoutType} = 'standard' and ${providerPayouts.paidAt} >= ${startOfWeek} then ${providerPayouts.amount} else 0 end), 0)`,
      monthEarnings: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'paid' and ${providerPayouts.payoutType} = 'standard' and ${providerPayouts.paidAt} >= ${startOfMonth} then ${providerPayouts.amount} else 0 end), 0)`,
    })
    .from(providerPayouts)
    .where(eq(providerPayouts.providerId, provider.id));

  return c.json({
    thisWeek: Number(summary?.weekEarnings ?? 0),
    thisMonth: Number(summary?.monthEarnings ?? 0),
    allTime: Number(summary?.totalEarnings ?? 0),
    pending: Number(summary?.totalPending ?? 0),
    held: Number(summary?.totalHeld ?? 0),
    clawbacks: Number(summary?.totalClawback ?? 0),
    totalJobs: Number(summary?.jobCount ?? 0),
  });
});

// GET /provider/earnings/history — paginated payout list
app.get("/earnings/history", async (c) => {
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
    columns: { id: true },
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  const [totalResult] = await db
    .select({ total: count() })
    .from(providerPayouts)
    .where(eq(providerPayouts.providerId, provider.id));

  const payoutsList = await db
    .select({
      id: providerPayouts.id,
      bookingId: providerPayouts.bookingId,
      amount: providerPayouts.amount,
      status: providerPayouts.status,
      payoutMethod: providerPayouts.payoutMethod,
      payoutType: providerPayouts.payoutType,
      paidAt: providerPayouts.paidAt,
      heldAt: providerPayouts.heldAt,
      holdReason: providerPayouts.holdReason,
      createdAt: providerPayouts.createdAt,
    })
    .from(providerPayouts)
    .where(eq(providerPayouts.providerId, provider.id))
    .orderBy(desc(providerPayouts.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    payouts: payoutsList,
    pagination: {
      page,
      limit,
      total: Number(totalResult?.total ?? 0),
      totalPages: Math.ceil(Number(totalResult?.total ?? 0) / limit),
    },
  });
});

// GET /provider/earnings/pending — pending/held payouts
app.get("/earnings/pending", async (c) => {
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
    columns: { id: true },
  });
  if (!provider) return c.json({ error: "Provider not found" }, 404);

  const pendingPayouts = await db
    .select({
      id: providerPayouts.id,
      bookingId: providerPayouts.bookingId,
      amount: providerPayouts.amount,
      status: providerPayouts.status,
      payoutMethod: providerPayouts.payoutMethod,
      holdReason: providerPayouts.holdReason,
      createdAt: providerPayouts.createdAt,
    })
    .from(providerPayouts)
    .where(
      and(
        eq(providerPayouts.providerId, provider.id),
        sql`${providerPayouts.status} IN ('pending', 'held')`,
        sql`${providerPayouts.payoutType} = 'standard'`,
      ),
    )
    .orderBy(desc(providerPayouts.createdAt));

  return c.json({ payouts: pendingPayouts });
});

export default app;
