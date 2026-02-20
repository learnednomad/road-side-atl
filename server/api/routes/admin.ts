import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "@/db";
import { bookings, services, payments, users, providers } from "@/db/schema";
import { eq, desc, sql, and, gte, lte, count, or, ilike } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import {
  updateBookingStatusSchema,
  confirmPaymentSchema,
  assignProviderSchema,
  overrideBookingPriceSchema,
  updateServiceCommissionSchema,
  updateChecklistConfigSchema,
} from "@/lib/validators";
import { createPayoutIfEligible } from "../lib/payout-calculator";
import { incrementCleanTransaction } from "../lib/trust-tier";
import { generateCSV } from "@/lib/csv";
import { autoDispatchBooking } from "../lib/auto-dispatch";
import { notifyStatusChange, notifyProviderAssigned, notifyReferralLink, notifyPreServiceConfirmation, notifyPaymentConfirmed } from "@/lib/notifications";
import { broadcastToAdmins, broadcastToUser, broadcastToProvider } from "@/server/websocket/broadcast";
import { rateLimitStandard, rateLimitStrict } from "../middleware/rate-limit";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import type { AuditAction } from "../lib/audit-logger";
import { clearDelayNotification } from "../lib/delay-tracker";
import { generateReferralCode, creditReferralOnFirstBooking } from "../lib/referral-credits";
import { calculateEtaMinutes } from "../lib/eta-calculator";
import { BOOKING_STATUSES, SERVICE_CATEGORIES } from "@/lib/constants";
import type { BookingStatus, ServiceCategory } from "@/lib/constants";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);
app.use("/*", rateLimitStandard);
// Stricter rate limiting for sensitive operations
app.use("/bookings/:id/notes", rateLimitStrict);
app.use("/bookings/:id/status", rateLimitStrict);
app.use("/bookings/:id/assign-provider", rateLimitStrict);
app.use("/payments/:id/confirm", rateLimitStrict);
app.use("/bookings/:id/override-price", rateLimitStrict);

const bookingStatusValues = new Set(BOOKING_STATUSES);
const serviceCategoryValues = new Set(SERVICE_CATEGORIES);
function isBookingStatus(value: string): value is BookingStatus {
  return bookingStatusValues.has(value as BookingStatus);
}
function isServiceCategory(value: string): value is ServiceCategory {
  return serviceCategoryValues.has(value as ServiceCategory);
}
app.use("/services/:id/commission", rateLimitStrict);
app.use("/services/:id/checklist", rateLimitStrict);

// Dashboard stats
app.get("/stats", async (c) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayBookings] = await db
    .select({ count: count() })
    .from(bookings)
    .where(gte(bookings.createdAt, todayStart));

  const [pendingBookings] = await db
    .select({ count: count() })
    .from(bookings)
    .where(eq(bookings.status, "pending"));

  const [weeklyRevenue] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.status, "confirmed"), gte(payments.createdAt, weekStart)));

  const [monthlyRevenue] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(
      and(eq(payments.status, "confirmed"), gte(payments.createdAt, monthStart))
    );

  return c.json({
    todayBookings: todayBookings.count,
    pendingBookings: pendingBookings.count,
    weeklyRevenue: weeklyRevenue.total,
    monthlyRevenue: monthlyRevenue.total,
  });
});

// Sparkline data: last 7 days of daily bookings + revenue
app.get("/stats/sparklines", async (c) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const dailyBookings = await db
    .select({
      date: sql<string>`date(${bookings.createdAt})`,
      count: count(),
    })
    .from(bookings)
    .where(gte(bookings.createdAt, sevenDaysAgo))
    .groupBy(sql`date(${bookings.createdAt})`)
    .orderBy(sql`date(${bookings.createdAt})`);

  const dailyRevenue = await db
    .select({
      date: sql<string>`date(${payments.createdAt})`,
      total: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(and(eq(payments.status, "confirmed"), gte(payments.createdAt, sevenDaysAgo)))
    .groupBy(sql`date(${payments.createdAt})`)
    .orderBy(sql`date(${payments.createdAt})`);

  // Fill in missing days with 0
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const bookingMap = new Map(dailyBookings.map((r) => [r.date, r.count]));
  const revenueMap = new Map(dailyRevenue.map((r) => [r.date, Number(r.total)]));

  return c.json({
    bookings: days.map((d) => bookingMap.get(d) || 0),
    revenue: days.map((d) => revenueMap.get(d) || 0),
    labels: days,
  });
});

// All bookings (filterable + pagination + search)
app.get("/bookings", async (c) => {
  const status = c.req.query("status");
  const serviceType = c.req.query("serviceType");
  const search = c.req.query("search");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (status && isBookingStatus(status)) {
    conditions.push(eq(bookings.status, status));
  }
  if (serviceType && isServiceCategory(serviceType)) {
    conditions.push(eq(services.category, serviceType));
  }
  if (search) {
    conditions.push(
      or(
        ilike(bookings.contactName, `%${search}%`),
        ilike(bookings.contactPhone, `%${search}%`),
        ilike(bookings.contactEmail, `%${search}%`)
      )!
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total
  const [totalResult] = await db
    .select({ count: count() })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(whereClause);

  let query = db
    .select({
      booking: bookings,
      service: services,
      payment: payments,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset(offset)
    .$dynamic();

  if (whereClause) {
    query = query.where(whereClause);
  }

  const results = await query;

  // Group payments by booking
  type Booking = typeof bookings.$inferSelect;
  type Service = typeof services.$inferSelect;
  type Payment = typeof payments.$inferSelect;
  const bookingMap = new Map<
    string,
    { booking: Booking; service: Service; payments: Payment[] }
  >();
  for (const row of results) {
    const existing = bookingMap.get(row.booking.id);
    if (existing) {
      if (row.payment) existing.payments.push(row.payment);
    } else {
      bookingMap.set(row.booking.id, {
        booking: row.booking,
        service: row.service,
        payments: row.payment ? [row.payment] : [],
      });
    }
  }

  return c.json({
    data: Array.from(bookingMap.values()),
    total: totalResult.count,
    page,
    limit,
    totalPages: Math.ceil(totalResult.count / limit),
  });
});

// Update booking internal notes (FR79)
app.patch("/bookings/:id/notes", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = z.object({ notes: z.string().max(2000) }).safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);

  const [updated] = await db
    .update(bookings)
    .set({ notes: parsed.data.notes, updatedAt: new Date() })
    .where(eq(bookings.id, id))
    .returning();

  if (!updated) return c.json({ error: "Booking not found" }, 404);

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "booking.update_notes",
    userId: user.id,
    resourceType: "booking",
    resourceId: id,
    details: { notesLength: parsed.data.notes.length },
    ipAddress,
    userAgent,
  });

  return c.json({ success: true });
});

// Assign provider to booking
app.patch("/bookings/:id/assign-provider", async (c) => {
  const bookingId = c.req.param("id");
  const body = await c.req.json();
  const parsed = assignProviderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  // Verify provider exists and is active
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, parsed.data.providerId),
  });
  if (!provider || provider.status !== "active") {
    return c.json({ error: "Provider not found or inactive" }, 400);
  }

  const [updated] = await db
    .update(bookings)
    .set({ providerId: parsed.data.providerId, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  if (!updated) {
    return c.json({ error: "Booking not found" }, 404);
  }

  // Audit log the assignment
  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "booking.assign_provider",
    userId: user.id,
    resourceType: "booking",
    resourceId: bookingId,
    details: { providerId: provider.id, providerName: provider.name },
    ipAddress,
    userAgent,
  });

  // Fetch service for price + commission data (FR39) and pre-service check (FR66)
  const service = updated.serviceId
    ? await db.query.services.findFirst({ where: eq(services.id, updated.serviceId) })
    : null;

  // Calculate estimated payout for provider notification (FR39)
  const estimatedPrice = updated.estimatedPrice || 0;
  let estimatedPayout = 0;
  if (provider.commissionType === "flat_per_job") {
    estimatedPayout = provider.flatFeeAmount || 0;
  } else if (service && service.commissionRate > 0) {
    const platformCut = Math.round(estimatedPrice * service.commissionRate / 10000);
    estimatedPayout = estimatedPrice - platformCut;
  } else {
    estimatedPayout = Math.round(estimatedPrice * provider.commissionRate / 10000);
  }

  // Notify provider
  notifyProviderAssigned(updated, provider, estimatedPrice, estimatedPayout, service?.name).catch(() => {});
  if (provider.userId) {
    broadcastToProvider(provider.userId, {
      type: "provider:job_assigned",
      data: {
        bookingId,
        providerId: provider.id,
        contactName: updated.contactName,
        address: (updated.location as { address: string }).address,
        serviceName: service?.name,
        estimatedPrice,
        estimatedPayout,
      },
    });
  }
  broadcastToAdmins({ type: "booking:status_changed", data: { bookingId, status: updated.status } });

  // Pre-service confirmation for diagnostic/inspection bookings (FR66)
  if (service && (service.category === "diagnostics" || service.slug.includes("inspection"))) {
    // Calculate ETA from provider location to booking location if coordinates available
    let etaDisplay = "30-45 minutes";
    const bookingLat = (updated.location as { latitude?: number })?.latitude;
    const bookingLng = (updated.location as { longitude?: number })?.longitude;
    if (provider.latitude && provider.longitude && bookingLat && bookingLng) {
      const etaMins = calculateEtaMinutes(provider.latitude, provider.longitude, bookingLat, bookingLng);
      etaDisplay = `approximately ${etaMins} minutes`;
    }
    // TODO: Replace with real-time GPS-based ETA calculation when provider begins en-route

    notifyPreServiceConfirmation(
      { name: updated.contactName, email: updated.contactEmail, phone: updated.contactPhone },
      provider.name,
      etaDisplay,
      service.name,
    ).catch(() => {});
  }

  return c.json(updated);
});

// Update booking status
app.patch("/bookings/:id/status", async (c) => {
  const bookingId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateBookingStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid status" }, 400);
  }

  // Get previous status for audit log
  const existingBooking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  const [updated] = await db
    .update(bookings)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  if (!updated) {
    return c.json({ error: "Booking not found" }, 404);
  }

  // Audit log the status change
  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "booking.status_change",
    userId: user.id,
    resourceType: "booking",
    resourceId: bookingId,
    details: {
      previousStatus: existingBooking?.status,
      newStatus: parsed.data.status,
    },
    ipAddress,
    userAgent,
  });

  // Auto-create payout when booking completed
  let amountPaid: number | undefined;
  if (parsed.data.status === "completed") {
    await createPayoutIfEligible(bookingId);

    // Fetch confirmed payment amount for completion notification (FR32)
    const confirmedPayment = await db.query.payments.findFirst({
      where: and(eq(payments.bookingId, bookingId), eq(payments.status, "confirmed")),
    });
    amountPaid = confirmedPayment?.amount;

    // Post-service referral SMS (fire-and-forget) — only if payment confirmed
    if (confirmedPayment && updated.contactPhone && updated.userId) {
      (async () => {
        const bookingUser = await db.query.users.findFirst({
          where: eq(users.id, updated.userId!),
        });
        if (bookingUser) {
          let referralCode = bookingUser.referralCode;
          if (!referralCode) {
            referralCode = await generateReferralCode(bookingUser.id);
          }
          const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || ""}/register?ref=${referralCode}`;
          notifyReferralLink(updated.contactPhone, referralLink).catch(() => {});
        }
      })().catch(() => {});
    }

    // Credit referral on first booking completion (fire-and-forget)
    if (updated.userId) {
      (async () => {
        await creditReferralOnFirstBooking(updated.userId!, bookingId);
      })().catch(() => {});
    }
  }

  if (parsed.data.status === "completed" || parsed.data.status === "cancelled") {
    if (updated.providerId) {
      db.update(providers)
        .set({ currentLocation: null, lastLocationUpdate: null, updatedAt: new Date() })
        .where(eq(providers.id, updated.providerId))
        .catch(() => {});
    }
    clearDelayNotification(bookingId);
  }

  // Auto-dispatch when confirmed
  let dispatchResult = null;
  if (parsed.data.status === "confirmed") {
    dispatchResult = await autoDispatchBooking(bookingId).catch(() => null);
  }

  // Fire-and-forget notifications (FR32: completion includes amount paid)
  notifyStatusChange(updated, parsed.data.status, amountPaid).catch(() => {});

  // WebSocket broadcasts
  broadcastToAdmins({ type: "booking:status_changed", data: { bookingId, status: parsed.data.status } });
  if (updated.userId) {
    broadcastToUser(updated.userId, { type: "booking:status_changed", data: { bookingId, status: parsed.data.status } });
  }

  return c.json({ ...updated, dispatchResult });
});

// Confirm payment (cash/cashapp/zelle)
app.patch("/payments/:id/confirm", async (c) => {
  const paymentId = c.req.param("id");
  const body = await c.req.json();
  const parsed = confirmPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const user = c.get("user");

  const existingPayment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
  });

  if (existingPayment) {
    const wasAlreadyConfirmed = existingPayment.status === "confirmed";

    const [updated] = await db
      .update(payments)
      .set({
        status: "confirmed",
        method: parsed.data.method,
        confirmedAt: new Date(),
        confirmedBy: user.id,
      })
      .where(eq(payments.id, paymentId))
      .returning();

    // Audit log the payment confirmation
    const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
    logAudit({
      action: "payment.confirm",
      userId: user.id,
      resourceType: "payment",
      resourceId: paymentId,
      details: {
        bookingId: existingPayment.bookingId,
        amount: existingPayment.amount,
        method: parsed.data.method,
      },
      ipAddress,
      userAgent,
    });

    // Fetch full booking once for trust tier + receipt + payout
    const fullBooking = await db.query.bookings.findFirst({
      where: eq(bookings.id, existingPayment.bookingId),
    });

    // Increment clean transaction count for trust tier promotion
    if (fullBooking?.userId) {
      await incrementCleanTransaction(fullBooking.userId);
    }

    // Send receipt notification and create payout (only on first confirmation)
    if (fullBooking && !wasAlreadyConfirmed) {
      const service = await db.query.services.findFirst({
        where: eq(services.id, fullBooking.serviceId),
      });
      let providerName: string | undefined;
      if (fullBooking.providerId) {
        const provider = await db.query.providers.findFirst({
          where: eq(providers.id, fullBooking.providerId),
          columns: { name: true },
        });
        providerName = provider?.name;
      }

      // Send receipt notification (fire-and-forget)
      notifyPaymentConfirmed(
        { name: fullBooking.contactName, email: fullBooking.contactEmail, phone: fullBooking.contactPhone },
        fullBooking.id,
        service?.name || "Service",
        existingPayment.amount,
        parsed.data.method,
        updated.confirmedAt?.toISOString() || new Date().toISOString(),
        providerName
      ).catch(() => {});

      // Audit receipt sent
      logAudit({
        action: "payment.receipt_sent",
        userId: user.id,
        resourceType: "payment",
        resourceId: paymentId,
        details: { bookingId: existingPayment.bookingId, email: fullBooking.contactEmail },
        ipAddress,
        userAgent,
      });

      // Create payout if eligible (was missing from this endpoint)
      createPayoutIfEligible(fullBooking.id).catch((err) => {
        console.error("[Payment] Failed to create payout for booking:", fullBooking.id, err);
      });
    }

    return c.json(updated);
  }

  return c.json({ error: "Payment not found" }, 404);
});

// Confirm payment by booking ID
app.post("/bookings/:id/confirm-payment", async (c) => {
  const bookingId = c.req.param("id");
  const body = await c.req.json();
  const parsed = confirmPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const user = c.get("user");

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });
  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }

  const amount = parsed.data.amount || booking.estimatedPrice;

  const [payment] = await db
    .insert(payments)
    .values({
      bookingId,
      amount,
      method: parsed.data.method,
      status: "confirmed",
      confirmedAt: new Date(),
      confirmedBy: user.id,
    })
    .returning();

  await db
    .update(bookings)
    .set({ finalPrice: amount, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));

  // Audit log the payment confirmation
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "payment.confirm",
    userId: user.id,
    resourceType: "payment",
    resourceId: payment.id,
    details: {
      bookingId,
      amount,
      method: parsed.data.method,
    },
    ipAddress,
    userAgent,
  });

  // Increment clean transaction count for trust tier promotion
  if (booking.userId) {
    await incrementCleanTransaction(booking.userId);
  }

  // Try to create payout if booking is already completed
  await createPayoutIfEligible(bookingId);

  // Send receipt notification
  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });
  let providerName: string | undefined;
  if (booking.providerId) {
    const provider = await db.query.providers.findFirst({
      where: eq(providers.id, booking.providerId),
      columns: { name: true },
    });
    providerName = provider?.name;
  }

  // Fire-and-forget receipt notification
  notifyPaymentConfirmed(
    { name: booking.contactName, email: booking.contactEmail, phone: booking.contactPhone },
    bookingId,
    service?.name || "Service",
    amount,
    parsed.data.method,
    payment.confirmedAt?.toISOString() || new Date().toISOString(),
    providerName
  ).catch(() => {});

  // Audit receipt sent
  logAudit({
    action: "payment.receipt_sent",
    userId: user.id,
    resourceType: "payment",
    resourceId: payment.id,
    details: { bookingId, email: booking.contactEmail },
    ipAddress,
    userAgent,
  });

  return c.json(payment, 201);
});

// Revenue analytics with date range and period comparison
app.get("/revenue/analytics", async (c) => {
  const startDateStr = c.req.query("startDate");
  const endDateStr = c.req.query("endDate");

  const endDate = endDateStr ? new Date(endDateStr) : new Date();
  const startDate = startDateStr
    ? new Date(startDateStr)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Previous period for comparison (same duration, just before startDate)
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevStart = new Date(startDate.getTime() - periodMs);
  const prevEnd = new Date(startDate.getTime());

  // Daily series for current period
  const dailySeries = await db
    .select({
      date: sql<string>`date(${payments.confirmedAt})`,
      total: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      count: count(),
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "confirmed"),
        gte(payments.confirmedAt, startDate),
        lte(payments.confirmedAt, endDate)
      )
    )
    .groupBy(sql`date(${payments.confirmedAt})`)
    .orderBy(sql`date(${payments.confirmedAt})`);

  // Previous period daily series
  const prevDailySeries = await db
    .select({
      date: sql<string>`date(${payments.confirmedAt})`,
      total: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "confirmed"),
        gte(payments.confirmedAt, prevStart),
        lte(payments.confirmedAt, prevEnd)
      )
    )
    .groupBy(sql`date(${payments.confirmedAt})`)
    .orderBy(sql`date(${payments.confirmedAt})`);

  // By service
  const byService = await db
    .select({
      serviceName: services.name,
      total: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      count: count(),
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(
      and(
        eq(payments.status, "confirmed"),
        gte(payments.confirmedAt, startDate),
        lte(payments.confirmedAt, endDate)
      )
    )
    .groupBy(services.name);

  // By payment method
  const byMethod = await db
    .select({
      method: payments.method,
      total: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      count: count(),
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "confirmed"),
        gte(payments.confirmedAt, startDate),
        lte(payments.confirmedAt, endDate)
      )
    )
    .groupBy(payments.method);

  // Summary for current period
  const currentTotal = dailySeries.reduce((sum, r) => sum + Number(r.total), 0);
  const currentCount = dailySeries.reduce((sum, r) => sum + r.count, 0);
  const prevTotal = prevDailySeries.reduce((sum, r) => sum + Number(r.total), 0);

  // Completed bookings in period
  const [completedResult] = await db
    .select({ count: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "completed"),
        gte(bookings.updatedAt, startDate),
        lte(bookings.updatedAt, endDate)
      )
    );

  const [totalBookingsResult] = await db
    .select({ count: count() })
    .from(bookings)
    .where(
      and(
        gte(bookings.createdAt, startDate),
        lte(bookings.createdAt, endDate)
      )
    );

  // Refund total
  const [refundResult] = await db
    .select({
      total: sql<number>`coalesce(sum(${payments.amount}), 0)`,
      count: count(),
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "refunded"),
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      )
    );

  // Failed payments
  const failedPayments = await db
    .select({
      payment: payments,
      booking: bookings,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .where(
      and(
        or(eq(payments.status, "refunded"), eq(payments.status, "failed")),
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      )
    )
    .orderBy(desc(payments.createdAt));

  const completionRate =
    totalBookingsResult.count > 0
      ? (completedResult.count / totalBookingsResult.count) * 100
      : 0;

  const revenueChange =
    prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

  return c.json({
    dailySeries: dailySeries.map((r) => ({
      date: r.date,
      total: Number(r.total),
      count: r.count,
    })),
    prevDailySeries: prevDailySeries.map((r) => ({
      date: r.date,
      total: Number(r.total),
    })),
    byService: byService.map((r) => ({
      serviceName: r.serviceName,
      total: Number(r.total),
      count: r.count,
    })),
    byMethod: byMethod.map((r) => ({
      method: r.method,
      total: Number(r.total),
      count: r.count,
    })),
    summary: {
      totalRevenue: currentTotal,
      transactionCount: currentCount,
      avgBookingValue: currentCount > 0 ? Math.round(currentTotal / currentCount) : 0,
      completionRate: Math.round(completionRate * 10) / 10,
      refundTotal: Number(refundResult.total),
      refundCount: refundResult.count,
      revenueChange: Math.round(revenueChange * 10) / 10,
    },
    failedPayments: failedPayments.map((r) => ({
      payment: r.payment,
      booking: r.booking,
    })),
  });
});

// Revenue summary (legacy)
app.get("/revenue", async (c) => {
  const confirmedPayments = await db
    .select({
      method: payments.method,
      total: sql<number>`sum(${payments.amount})`,
      count: count(),
    })
    .from(payments)
    .where(eq(payments.status, "confirmed"))
    .groupBy(payments.method);

  const byService = await db
    .select({
      serviceName: services.name,
      total: sql<number>`sum(${payments.amount})`,
      count: count(),
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(payments.status, "confirmed"))
    .groupBy(services.name);

  return c.json({ byMethod: confirmedPayments, byService });
});

// CSV export: bookings
app.get("/bookings/export", async (c) => {
  const status = c.req.query("status");
  const startDateStr = c.req.query("startDate");
  const endDateStr = c.req.query("endDate");

  const conditions: SQL[] = [];
  if (status && isBookingStatus(status)) {
    conditions.push(eq(bookings.status, status));
  }
  if (startDateStr) {
    conditions.push(gte(bookings.createdAt, new Date(startDateStr)));
  }
  if (endDateStr) {
    conditions.push(lte(bookings.createdAt, new Date(endDateStr)));
  }

  let query = db
    .select({
      booking: bookings,
      service: services,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .orderBy(desc(bookings.createdAt))
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query;

  const csv = generateCSV(
    ["Date", "Customer", "Email", "Phone", "Service", "Status", "Estimated Price", "Final Price"],
    results.map(({ booking, service }) => [
      booking.createdAt.toISOString().split("T")[0],
      booking.contactName,
      booking.contactEmail,
      booking.contactPhone,
      service.name,
      booking.status,
      (booking.estimatedPrice / 100).toFixed(2),
      booking.finalPrice ? (booking.finalPrice / 100).toFixed(2) : "",
    ])
  );

  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", "attachment; filename=bookings.csv");
  return c.body(csv);
});

// CSV export: revenue
app.get("/revenue/export", async (c) => {
  const startDateStr = c.req.query("startDate");
  const endDateStr = c.req.query("endDate");

  const conditions = [eq(payments.status, "confirmed")];
  if (startDateStr) {
    conditions.push(gte(payments.confirmedAt, new Date(startDateStr)));
  }
  if (endDateStr) {
    conditions.push(lte(payments.confirmedAt, new Date(endDateStr)));
  }

  const results = await db
    .select({
      payment: payments,
      booking: bookings,
      service: services,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(...conditions))
    .orderBy(desc(payments.confirmedAt));

  const csv = generateCSV(
    ["Date", "Customer", "Service", "Method", "Amount", "Status"],
    results.map(({ payment, booking, service }) => [
      payment.confirmedAt?.toISOString().split("T")[0] || "",
      booking.contactName,
      service.name,
      payment.method,
      (payment.amount / 100).toFixed(2),
      payment.status,
    ])
  );

  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", "attachment; filename=revenue.csv");
  return c.body(csv);
});

// Customer list with search + pagination
app.get("/customers", async (c) => {
  const search = c.req.query("search");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const conditions = [eq(users.role, "customer")];
  if (search) {
    conditions.push(
      or(
        ilike(users.name, `%${search}%`),
        ilike(users.email, `%${search}%`)
      )!
    );
  }

  const [totalResult] = await db
    .select({ count: count() })
    .from(users)
    .where(and(...conditions));

  const customers = await db
    .select({
      user: users,
      bookingCount: count(bookings.id),
      totalSpent: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(users)
    .leftJoin(bookings, eq(users.id, bookings.userId))
    .leftJoin(
      payments,
      and(eq(payments.bookingId, bookings.id), eq(payments.status, "confirmed"))
    )
    .where(and(...conditions))
    .groupBy(users.id)
    .orderBy(desc(sql`count(${bookings.id})`))
    .limit(limit)
    .offset(offset);

  return c.json({
    data: customers,
    total: totalResult.count,
    page,
    limit,
    totalPages: Math.ceil(totalResult.count / limit),
  });
});

// Audit logs endpoint
app.get("/audit-logs", async (c) => {
  const action = c.req.query("action");
  const userId = c.req.query("userId");
  const resourceType = c.req.query("resourceType");
  const startDateStr = c.req.query("startDate");
  const endDateStr = c.req.query("endDate");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = (page - 1) * limit;

  try {
    const { queryAuditLogs } = await import("../lib/audit-logger");
    const logs = await queryAuditLogs({
      action: action as AuditAction,
      userId: userId || undefined,
      resourceType: resourceType || undefined,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      limit,
      offset,
    });

    return c.json({
      data: logs,
      page,
      limit,
    });
  } catch {
    return c.json({ data: [], page, limit, error: "Failed to query audit logs" });
  }
});

// PATCH /bookings/:id/override-price - Admin override booking price
app.patch("/bookings/:id/override-price", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
  });
  if (!existing) {
    return c.json({ error: "Booking not found" }, 404);
  }

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  // Handle clear override
  if (body.clear === true) {
    const [updated] = await db
      .update(bookings)
      .set({
        priceOverrideCents: null,
        priceOverrideReason: null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id))
      .returning();

    logAudit({
      action: "booking.price_override",
      userId: user.id,
      resourceType: "booking",
      resourceId: id,
      details: {
        previousOverrideCents: existing.priceOverrideCents,
        cleared: true,
      },
      ipAddress,
      userAgent,
    });

    broadcastToAdmins({
      type: "booking:price_override",
      data: { bookingId: id },
    });

    return c.json(updated, 200);
  }

  // Set/update override
  const parsed = overrideBookingPriceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { priceOverrideCents, reason } = parsed.data;

  const [updated] = await db
    .update(bookings)
    .set({
      priceOverrideCents,
      priceOverrideReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, id))
    .returning();

  logAudit({
    action: "booking.price_override",
    userId: user.id,
    resourceType: "booking",
    resourceId: id,
    details: {
      originalEstimatedPrice: existing.estimatedPrice,
      previousOverrideCents: existing.priceOverrideCents,
      priceOverrideCents,
      reason,
    },
    ipAddress,
    userAgent,
  });

  broadcastToAdmins({
    type: "booking:price_override",
    data: { bookingId: id },
  });

  return c.json(updated, 200);
});

// GET /services/commission - List all services with commission rates
app.get("/services/commission", async (c) => {
  const allServices = await db
    .select({
      id: services.id,
      name: services.name,
      slug: services.slug,
      category: services.category,
      basePrice: services.basePrice,
      commissionRate: services.commissionRate,
      active: services.active,
    })
    .from(services)
    .orderBy(services.category, services.name);

  return c.json(allServices);
});

// PATCH /services/:id/commission - Update service commission rate
app.patch("/services/:id/commission", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateServiceCommissionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const existing = await db.query.services.findFirst({
    where: eq(services.id, id),
  });
  if (!existing) {
    return c.json({ error: "Service not found" }, 404);
  }

  const [updated] = await db
    .update(services)
    .set({
      commissionRate: parsed.data.commissionRate,
      updatedAt: new Date(),
    })
    .where(eq(services.id, id))
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "commission.update_rate",
    userId: user.id,
    resourceType: "service",
    resourceId: id,
    details: {
      serviceName: existing.name,
      serviceCategory: existing.category,
      previousRate: existing.commissionRate,
      newRate: parsed.data.commissionRate,
    },
    ipAddress,
    userAgent,
  });

  broadcastToAdmins({
    type: "service:commission_updated",
    data: { serviceId: id, commissionRate: parsed.data.commissionRate },
  });

  return c.json(updated, 200);
});

// PUT /services/:id/checklist - Update service checklist config
app.put("/services/:id/checklist", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateChecklistConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const existing = await db.query.services.findFirst({
    where: eq(services.id, id),
  });
  if (!existing) {
    return c.json({ error: "Service not found" }, 404);
  }

  const [updated] = await db
    .update(services)
    .set({
      checklistConfig: parsed.data.checklistConfig,
      updatedAt: new Date(),
    })
    .where(eq(services.id, id))
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  await logAudit({
    action: "service.update_checklist_config",
    userId: user.id,
    resourceType: "service",
    resourceId: id,
    details: {
      serviceName: existing.name,
      categoryCount: parsed.data.checklistConfig.length,
    },
    ipAddress,
    userAgent,
  });

  return c.json(updated, 200);
});

export default app;
