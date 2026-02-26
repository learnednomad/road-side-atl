import { Hono } from "hono";
import { db } from "@/db";
import { b2bAccounts, bookings, services, invoices } from "@/db/schema";
import { eq, desc, and, ilike, count, inArray } from "drizzle-orm";
import { requireAdmin } from "@/server/api/middleware/auth";
import { rateLimitStandard } from "@/server/api/middleware/rate-limit";
import {
  createB2bAccountSchema,
  updateB2bAccountSchema,
  updateB2bContractSchema,
  updateB2bAccountStatusSchema,
  createB2bBookingSchema,
  generateB2bInvoiceSchema,
} from "@/lib/validators";
import { logAudit, getRequestInfo } from "@/server/api/lib/audit-logger";
import {
  TOWING_BASE_MILES,
  TOWING_PRICE_PER_MILE_CENTS,
} from "@/lib/constants";
import { calculateBookingPrice } from "@/server/api/lib/pricing-engine";
import { geocodeAddress } from "@/lib/geocoding";
import { notifyB2bServiceDispatched } from "@/lib/notifications";
import { broadcastToAdmins } from "@/server/websocket/broadcast";
import { autoDispatchBooking } from "../lib/auto-dispatch";
import { createB2bMonthlyInvoice } from "../lib/invoice-generator";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);
app.use("/*", rateLimitStandard);

// GET / — List B2B accounts with pagination, search, status filter
app.get("/", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20") || 20, 1), 100);
  const search = c.req.query("search") || "";
  const status = c.req.query("status") || "";
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(ilike(b2bAccounts.companyName, `%${search}%`));
  }
  if (status && ["pending", "active", "suspended"].includes(status)) {
    conditions.push(eq(b2bAccounts.status, status as "pending" | "active" | "suspended"));
  }

  const whereFilter = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(b2bAccounts)
    .where(whereFilter);

  const accounts = await db
    .select()
    .from(b2bAccounts)
    .where(whereFilter)
    .orderBy(desc(b2bAccounts.createdAt))
    .limit(limit)
    .offset(offset);

  // Add booking count per account (AC3)
  const accountIds = accounts.map((a) => a.id);
  const bookingCounts = accountIds.length > 0
    ? await db
        .select({ tenantId: bookings.tenantId, count: count() })
        .from(bookings)
        .where(inArray(bookings.tenantId, accountIds))
        .groupBy(bookings.tenantId)
    : [];
  const countMap = new Map(bookingCounts.map((bc) => [bc.tenantId, bc.count]));
  const accountsWithCounts = accounts.map((a) => ({
    ...a,
    bookingCount: countMap.get(a.id) || 0,
  }));

  const total = totalResult.count;
  const totalPages = Math.ceil(total / limit);

  return c.json({ data: accountsWithCounts, total, page, totalPages });
});

// POST / — Create new B2B account
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createB2bAccountSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const [account] = await db
    .insert(b2bAccounts)
    .values({
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      billingAddress: parsed.data.billingAddress,
      paymentTerms: parsed.data.paymentTerms || "net_30",
      notes: parsed.data.notes || null,
    })
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "b2b_account.create",
    userId: user.id,
    resourceType: "b2b_account",
    resourceId: account.id,
    details: {
      companyName: parsed.data.companyName,
      contactEmail: parsed.data.contactEmail,
    },
    ipAddress,
    userAgent,
  });

  return c.json(account, 201);
});

// GET /:id — Get single B2B account with booking count
app.get("/:id", async (c) => {
  const accountId = c.req.param("id");

  const account = await db.query.b2bAccounts.findFirst({
    where: eq(b2bAccounts.id, accountId),
  });

  if (!account) {
    return c.json({ error: "B2B account not found" }, 404);
  }

  const [bookingCount] = await db
    .select({ count: count() })
    .from(bookings)
    .where(eq(bookings.tenantId, accountId));

  return c.json({ ...account, bookingCount: bookingCount.count });
});

// PATCH /:id — Update B2B account details
app.patch("/:id", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateB2bAccountSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const existing = await db.query.b2bAccounts.findFirst({
    where: eq(b2bAccounts.id, accountId),
  });

  if (!existing) {
    return c.json({ error: "B2B account not found" }, 404);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.companyName !== undefined) updateData.companyName = parsed.data.companyName;
  if (parsed.data.contactName !== undefined) updateData.contactName = parsed.data.contactName;
  if (parsed.data.contactEmail !== undefined) updateData.contactEmail = parsed.data.contactEmail;
  if (parsed.data.contactPhone !== undefined) updateData.contactPhone = parsed.data.contactPhone;
  if (parsed.data.billingAddress !== undefined) updateData.billingAddress = parsed.data.billingAddress;
  if (parsed.data.paymentTerms !== undefined) updateData.paymentTerms = parsed.data.paymentTerms;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  const [updated] = await db
    .update(b2bAccounts)
    .set(updateData)
    .where(eq(b2bAccounts.id, accountId))
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "b2b_account.update",
    userId: user.id,
    resourceType: "b2b_account",
    resourceId: accountId,
    details: {
      companyName: updated.companyName,
      updatedFields: Object.keys(parsed.data),
    },
    ipAddress,
    userAgent,
  });

  return c.json(updated);
});

// PATCH /:id/contract — Update contract configuration
app.patch("/:id/contract", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateB2bContractSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const existing = await db.query.b2bAccounts.findFirst({
    where: eq(b2bAccounts.id, accountId),
  });

  if (!existing) {
    return c.json({ error: "B2B account not found" }, 404);
  }

  const [updated] = await db
    .update(b2bAccounts)
    .set({
      contract: parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(b2bAccounts.id, accountId))
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "b2b_account.update_contract",
    userId: user.id,
    resourceType: "b2b_account",
    resourceId: accountId,
    details: {
      companyName: updated.companyName,
      retainerAmountCents: parsed.data.retainerAmountCents,
      perJobRateCents: parsed.data.perJobRateCents,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      includedServiceCount: parsed.data.includedServiceIds.length,
    },
    ipAddress,
    userAgent,
  });

  return c.json(updated);
});

// PATCH /:id/status — Suspend/reactivate account
app.patch("/:id/status", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateB2bAccountStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }
  const { status } = parsed.data;

  const existing = await db.query.b2bAccounts.findFirst({
    where: eq(b2bAccounts.id, accountId),
  });

  if (!existing) {
    return c.json({ error: "B2B account not found" }, 404);
  }

  if (existing.status === status) {
    return c.json({ error: "Account is already in this status" }, 400);
  }

  const [updated] = await db
    .update(b2bAccounts)
    .set({
      status: status as "active" | "suspended" | "pending",
      updatedAt: new Date(),
    })
    .where(eq(b2bAccounts.id, accountId))
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "b2b_account.status_change",
    userId: user.id,
    resourceType: "b2b_account",
    resourceId: accountId,
    details: {
      companyName: existing.companyName,
      previousStatus: existing.status,
      newStatus: status,
    },
    ipAddress,
    userAgent,
  });

  return c.json(updated);
});

// POST /:id/bookings — Create booking on behalf of B2B account
app.post("/:id/bookings", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = createB2bBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  // Verify B2B account exists and is active
  const account = await db.query.b2bAccounts.findFirst({
    where: eq(b2bAccounts.id, accountId),
  });

  if (!account) {
    return c.json({ error: "B2B account not found" }, 404);
  }

  if (account.status === "suspended") {
    return c.json({ error: "Cannot create bookings for suspended accounts" }, 400);
  }

  const data = parsed.data;

  // Look up service
  const service = await db.query.services.findFirst({
    where: eq(services.id, data.serviceId),
  });
  if (!service) {
    return c.json({ error: "Service not found" }, 404);
  }

  // Calculate price via centralized pricing engine
  const pricing = await calculateBookingPrice(
    data.serviceId,
    data.scheduledAt ? new Date(data.scheduledAt) : null,
  );
  let estimatedPrice = pricing.finalPrice;
  let towingMiles: number | undefined;

  // Towing per-mile is ADDITIVE (not multiplied by time-block)
  if (service.slug === "towing" && data.location.estimatedMiles) {
    towingMiles = data.location.estimatedMiles;
    const extraMiles = Math.max(0, towingMiles - TOWING_BASE_MILES);
    estimatedPrice += extraMiles * TOWING_PRICE_PER_MILE_CENTS;
  }

  // Server-side geocoding fallback
  const locationData = { ...data.location };
  if (!locationData.latitude || !locationData.longitude) {
    const geocoded = await geocodeAddress(locationData.address).catch(() => null);
    if (geocoded) {
      locationData.latitude = geocoded.latitude;
      locationData.longitude = geocoded.longitude;
      locationData.placeId = geocoded.placeId;
    }
  }
  if (locationData.destination && !locationData.destinationLatitude) {
    const geocoded = await geocodeAddress(locationData.destination).catch(() => null);
    if (geocoded) {
      locationData.destinationLatitude = geocoded.latitude;
      locationData.destinationLongitude = geocoded.longitude;
    }
  }

  // Create booking with tenantId = B2B account ID
  const [booking] = await db
    .insert(bookings)
    .values({
      serviceId: data.serviceId,
      vehicleInfo: data.vehicleInfo,
      location: locationData,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      estimatedPrice,
      towingMiles,
      notes: data.notes,
      tenantId: accountId,
    })
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "b2b_account.create_booking",
    userId: user.id,
    resourceType: "booking",
    resourceId: booking.id,
    details: {
      b2bAccountId: accountId,
      companyName: account.companyName,
      serviceName: service.name,
      contactEmail: data.contactEmail,
      estimatedPrice,
    },
    ipAddress,
    userAgent,
  });

  // Fire-and-forget B2B-specific notification + broadcast
  notifyB2bServiceDispatched(
    { name: data.contactName, email: data.contactEmail, phone: data.contactPhone },
    account.companyName,
    service.name,
    data.location.address,
  ).catch((err) => { console.error("[Notifications] Failed:", err); });
  broadcastToAdmins({
    type: "booking:created",
    data: {
      bookingId: booking.id,
      contactName: booking.contactName,
      status: booking.status,
      serviceName: service.name,
      b2bAccountId: accountId,
    },
  });

  // Auto-dispatch for immediate bookings
  let dispatchResult = null;
  if (!booking.scheduledAt && process.env.AUTO_DISPATCH_ENABLED === "true") {
    dispatchResult = await autoDispatchBooking(booking.id).catch(() => null);
  }

  return c.json({
    ...booking,
    pricingBreakdown: {
      basePrice: pricing.basePrice,
      multiplier: pricing.multiplier,
      blockName: pricing.blockName,
    },
    dispatchResult,
  }, 201);
});

// GET /:id/invoices — List invoices for a B2B account
app.get("/:id/invoices", async (c) => {
  const accountId = c.req.param("id");

  const account = await db.query.b2bAccounts.findFirst({
    where: eq(b2bAccounts.id, accountId),
  });

  if (!account) {
    return c.json({ error: "B2B account not found" }, 404);
  }

  const results = await db
    .select()
    .from(invoices)
    .where(eq(invoices.tenantId, accountId))
    .orderBy(desc(invoices.createdAt));

  return c.json({
    data: results.map((inv) => ({
      ...inv,
      createdAt: inv.createdAt.toISOString(),
      issuedAt: inv.issuedAt?.toISOString() || null,
      paidAt: inv.paidAt?.toISOString() || null,
      dueDate: inv.dueDate?.toISOString() || null,
    })),
  });
});

// POST /:id/invoices — Generate B2B monthly invoice for billing period
app.post("/:id/invoices", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = generateB2bInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const account = await db.query.b2bAccounts.findFirst({
    where: eq(b2bAccounts.id, accountId),
  });

  if (!account) {
    return c.json({ error: "B2B account not found" }, 404);
  }

  if (account.status === "suspended") {
    return c.json({ error: "Cannot generate invoices for suspended accounts" }, 400);
  }

  const invoice = await createB2bMonthlyInvoice(
    accountId,
    parsed.data.billingPeriodStart,
    parsed.data.billingPeriodEnd,
  );

  if (!invoice) {
    return c.json({ error: "No uninvoiced completed bookings found in this billing period" }, 400);
  }

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "b2b_account.generate_invoice",
    userId: user.id,
    resourceType: "invoice",
    resourceId: invoice.id,
    details: {
      b2bAccountId: accountId,
      companyName: account.companyName,
      invoiceNumber: invoice.invoiceNumber,
      billingPeriodStart: parsed.data.billingPeriodStart,
      billingPeriodEnd: parsed.data.billingPeriodEnd,
      total: invoice.total,
    },
    ipAddress,
    userAgent,
  });

  return c.json(invoice, 201);
});

export default app;
