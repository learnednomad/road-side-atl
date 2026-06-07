import { Hono } from "hono";
import { db } from "@/db";
import { b2bAccounts, b2bPriceList, fleetVehicles, b2bEstimates, recurringBookingSchedules, bookings, services, invoices } from "@/db/schema";
import type { B2bEstimateLine } from "@/db/schema/b2b-estimates";
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
  setB2bPriceListSchema,
  createFleetVehicleSchema,
  createB2bEstimateSchema,
  convertB2bEstimateSchema,
  bulkB2bBookingSchema,
  createRecurringScheduleSchema,
} from "@/lib/validators";
import { logAudit, getRequestInfo } from "@/server/api/lib/audit-logger";
import { createB2bMonthlyInvoice } from "../lib/invoice-generator";
import { createB2bBooking, priceServiceForAccount, CreditLimitError } from "../lib/b2b-booking";
import { b2bCreditTransactions, b2bAccountMembers, users } from "@/db/schema";
import { recordB2bCreditPaymentSchema, addB2bMemberSchema } from "@/lib/validators";

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

  // Human-friendly sequential account number (B2B-00001). The partial unique
  // index backstops the rare concurrent-collision.
  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(b2bAccounts);
  const accountNumber = `B2B-${String(existingCount + 1).padStart(5, "0")}`;

  const [account] = await db
    .insert(b2bAccounts)
    .values({
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      billingAddress: parsed.data.billingAddress,
      paymentTerms: parsed.data.paymentTerms || "net_30",
      accountNumber,
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

  // Create the booking through the shared B2B path (price + geocode + insert +
  // notify + dispatch). Reused by bulk/recurring/estimate-convert.
  let result;
  try {
    result = await createB2bBooking(account, service, data);
  } catch (err) {
    if (err instanceof CreditLimitError) {
      return c.json(
        { error: "Credit limit exceeded", balanceCents: err.balanceCents, limitCents: err.limitCents },
        402,
      );
    }
    throw err;
  }
  const { booking, pricing, dispatchResult } = result;

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
      estimatedPrice: booking.estimatedPrice,
    },
    ipAddress,
    userAgent,
  });

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

// GET /:id/members — list portal members (admin)
app.get("/:id/members", async (c) => {
  const rows = await db
    .select({
      id: b2bAccountMembers.id,
      userId: b2bAccountMembers.userId,
      role: b2bAccountMembers.role,
      name: users.name,
      email: users.email,
      createdAt: b2bAccountMembers.createdAt,
    })
    .from(b2bAccountMembers)
    .leftJoin(users, eq(b2bAccountMembers.userId, users.id))
    .where(eq(b2bAccountMembers.accountId, c.req.param("id")));
  return c.json({ data: rows });
});

// POST /:id/members — add a portal member by email (admin; seeds the first owner)
app.post("/:id/members", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = addB2bMemberSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const account = await db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, accountId) });
  if (!account) return c.json({ error: "B2B account not found" }, 404);
  const targetUser = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (!targetUser) return c.json({ error: "No user with that email" }, 404);
  try {
    const [member] = await db
      .insert(b2bAccountMembers)
      .values({ accountId, userId: targetUser.id, role: parsed.data.role ?? "owner" })
      .returning();
    return c.json(member, 201);
  } catch {
    return c.json({ error: "User is already a member" }, 409);
  }
});

// DELETE /:id/members/:mid — remove a portal member (admin)
app.delete("/:id/members/:mid", async (c) => {
  const [deleted] = await db
    .delete(b2bAccountMembers)
    .where(and(eq(b2bAccountMembers.id, c.req.param("mid")), eq(b2bAccountMembers.accountId, c.req.param("id"))))
    .returning();
  if (!deleted) return c.json({ error: "Member not found" }, 404);
  return c.json({ success: true });
});

// GET /:id/credit — NET balance/limit + ledger
app.get("/:id/credit", async (c) => {
  const accountId = c.req.param("id");
  const account = await db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, accountId) });
  if (!account) return c.json({ error: "B2B account not found" }, 404);
  const transactions = await db
    .select()
    .from(b2bCreditTransactions)
    .where(eq(b2bCreditTransactions.accountId, accountId))
    .orderBy(desc(b2bCreditTransactions.createdAt))
    .limit(200);
  return c.json({
    currentBalanceCents: account.currentBalanceCents,
    creditLimitCents: account.creditLimitCents,
    availableCreditCents: Math.max(0, account.creditLimitCents - account.currentBalanceCents),
    transactions,
  });
});

// POST /:id/credit/payment — record an AR payment received (pays down balance)
app.post("/:id/credit/payment", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = recordB2bCreditPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }
  const result = await db.transaction(async (tx) => {
    const [acct] = await tx
      .select({ balance: b2bAccounts.currentBalanceCents })
      .from(b2bAccounts)
      .where(eq(b2bAccounts.id, accountId))
      .for("update");
    if (!acct) return null;
    const newBalance = acct.balance - parsed.data.amountCents;
    await tx.insert(b2bCreditTransactions).values({
      accountId,
      type: "payment",
      amountCents: -parsed.data.amountCents,
      invoiceId: parsed.data.invoiceId,
      notes: parsed.data.notes,
    });
    await tx
      .update(b2bAccounts)
      .set({ currentBalanceCents: newBalance, updatedAt: new Date() })
      .where(eq(b2bAccounts.id, accountId));
    return newBalance;
  });
  if (result === null) return c.json({ error: "B2B account not found" }, 404);

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "invoice.mark_paid",
    userId: user.id,
    resourceType: "b2b_account",
    resourceId: accountId,
    details: { amountCents: parsed.data.amountCents, newBalanceCents: result },
    ipAddress,
    userAgent,
  });
  return c.json({ currentBalanceCents: result });
});

// POST /:id/bookings/bulk — create many bookings at once (best-effort per item)
app.post("/:id/bookings/bulk", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = bulkB2bBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }
  const account = await db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, accountId) });
  if (!account) return c.json({ error: "B2B account not found" }, 404);
  if (account.status === "suspended") {
    return c.json({ error: "Cannot create bookings for suspended accounts" }, 400);
  }

  const created: string[] = [];
  const failed: { index: number; error: string }[] = [];
  for (let i = 0; i < parsed.data.bookings.length; i++) {
    const data = parsed.data.bookings[i];
    try {
      const service = await db.query.services.findFirst({ where: eq(services.id, data.serviceId) });
      if (!service) {
        failed.push({ index: i, error: "Service not found" });
        continue;
      }
      const { booking } = await createB2bBooking(account, service, data);
      created.push(booking.id);
    } catch (err) {
      failed.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "b2b_account.create_booking",
    userId: user.id,
    resourceType: "b2b_account",
    resourceId: accountId,
    details: { companyName: account.companyName, bulkCreated: created.length, bulkFailed: failed.length },
    ipAddress,
    userAgent,
  });
  return c.json({ created, failed }, failed.length && !created.length ? 400 : 201);
});

// POST /:id/recurring — create a recurring booking schedule
app.post("/:id/recurring", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = createRecurringScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }
  const account = await db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, accountId) });
  if (!account) return c.json({ error: "B2B account not found" }, 404);
  const service = await db.query.services.findFirst({ where: eq(services.id, parsed.data.serviceId) });
  if (!service) return c.json({ error: "Service not found" }, 400);

  const [schedule] = await db
    .insert(recurringBookingSchedules)
    .values({
      accountId,
      serviceId: parsed.data.serviceId,
      frequency: parsed.data.frequency,
      intervalCount: parsed.data.intervalCount ?? 1,
      nextRunAt: parsed.data.startAt ? new Date(parsed.data.startAt) : new Date(),
      template: parsed.data.template,
    })
    .returning();
  return c.json(schedule, 201);
});

// GET /:id/recurring — list recurring schedules
app.get("/:id/recurring", async (c) => {
  const rows = await db
    .select()
    .from(recurringBookingSchedules)
    .where(eq(recurringBookingSchedules.accountId, c.req.param("id")))
    .orderBy(desc(recurringBookingSchedules.createdAt));
  return c.json({ data: rows });
});

// DELETE /:id/recurring/:rid — deactivate a recurring schedule
app.delete("/:id/recurring/:rid", async (c) => {
  const [updated] = await db
    .update(recurringBookingSchedules)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(recurringBookingSchedules.id, c.req.param("rid")),
        eq(recurringBookingSchedules.accountId, c.req.param("id")),
      ),
    )
    .returning();
  if (!updated) return c.json({ error: "Schedule not found" }, 404);
  return c.json({ success: true });
});

// POST /:id/estimates — build an account-priced, banded estimate
app.post("/:id/estimates", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = createB2bEstimateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }
  const account = await db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, accountId) });
  if (!account) return c.json({ error: "B2B account not found" }, 404);

  const lines: B2bEstimateLine[] = [];
  let subtotalCents = 0;
  let estMinCents = 0;
  let estMaxCents = 0;
  for (const line of parsed.data.lines) {
    const service = await db.query.services.findFirst({ where: eq(services.id, line.serviceId) });
    if (!service) return c.json({ error: `Service not found: ${line.serviceId}` }, 400);
    const { unitPriceCents, source } = await priceServiceForAccount(account, line.serviceId);
    const minUnit = service.estimateMinCents ?? unitPriceCents;
    const maxUnit = service.estimateMaxCents ?? unitPriceCents;
    lines.push({
      serviceId: service.id,
      serviceName: service.name,
      qty: line.qty,
      unitPriceCents,
      source,
      lineMinCents: minUnit * line.qty,
      lineMaxCents: maxUnit * line.qty,
      fleetVehicleId: line.fleetVehicleId ?? null,
    });
    subtotalCents += unitPriceCents * line.qty;
    estMinCents += minUnit * line.qty;
    estMaxCents += maxUnit * line.qty;
  }

  const [estimate] = await db
    .insert(b2bEstimates)
    .values({
      accountId,
      title: parsed.data.title,
      notes: parsed.data.notes,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
      lines,
      subtotalCents,
      estMinCents,
      estMaxCents,
    })
    .returning();
  return c.json(estimate, 201);
});

// GET /:id/estimates — list estimates for an account
app.get("/:id/estimates", async (c) => {
  const accountId = c.req.param("id");
  const rows = await db
    .select()
    .from(b2bEstimates)
    .where(eq(b2bEstimates.accountId, accountId))
    .orderBy(desc(b2bEstimates.createdAt));
  return c.json({ data: rows });
});

// GET /:id/estimates/:eid — estimate detail
app.get("/:id/estimates/:eid", async (c) => {
  const estimate = await db.query.b2bEstimates.findFirst({
    where: and(eq(b2bEstimates.id, c.req.param("eid")), eq(b2bEstimates.accountId, c.req.param("id"))),
  });
  if (!estimate) return c.json({ error: "Estimate not found" }, 404);
  return c.json(estimate);
});

// POST /:id/estimates/:eid/convert — create bookings from an estimate's lines
app.post("/:id/estimates/:eid/convert", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = convertB2bEstimateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }
  const account = await db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, accountId) });
  if (!account) return c.json({ error: "B2B account not found" }, 404);
  if (account.status === "suspended") {
    return c.json({ error: "Cannot create bookings for suspended accounts" }, 400);
  }
  const estimate = await db.query.b2bEstimates.findFirst({
    where: and(eq(b2bEstimates.id, c.req.param("eid")), eq(b2bEstimates.accountId, accountId)),
  });
  if (!estimate) return c.json({ error: "Estimate not found" }, 404);
  if (estimate.status === "converted") {
    return c.json({ error: "Estimate already converted" }, 400);
  }

  const bookingIds: string[] = [];
  for (const line of estimate.lines) {
    const service = await db.query.services.findFirst({ where: eq(services.id, line.serviceId) });
    if (!service) continue;
    for (let i = 0; i < line.qty; i++) {
      const { booking } = await createB2bBooking(
        account,
        service,
        {
          serviceId: line.serviceId,
          vehicleInfo: parsed.data.vehicleInfo,
          location: parsed.data.location,
          contactName: parsed.data.contactName,
          contactPhone: parsed.data.contactPhone,
          contactEmail: parsed.data.contactEmail,
          scheduledAt: parsed.data.scheduledAt,
          fleetVehicleId: line.fleetVehicleId ?? undefined,
          notes: `From estimate ${estimate.id}`,
        },
        { priceOverrideCents: line.unitPriceCents }, // frozen quote price (1b)
      );
      bookingIds.push(booking.id);
    }
  }

  const [updated] = await db
    .update(b2bEstimates)
    .set({ status: "converted", convertedBookingIds: bookingIds, updatedAt: new Date() })
    .where(eq(b2bEstimates.id, estimate.id))
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "b2b_account.create_booking",
    userId: user.id,
    resourceType: "b2b_estimate",
    resourceId: estimate.id,
    details: { companyName: account.companyName, bookingsCreated: bookingIds.length },
    ipAddress,
    userAgent,
  });
  return c.json({ estimate: updated, bookingIds }, 201);
});

// GET /:id/vehicles — fleet vehicles for an account
app.get("/:id/vehicles", async (c) => {
  const accountId = c.req.param("id");
  const rows = await db
    .select()
    .from(fleetVehicles)
    .where(eq(fleetVehicles.accountId, accountId))
    .orderBy(desc(fleetVehicles.createdAt));
  return c.json({ data: rows });
});

// POST /:id/vehicles — add a fleet vehicle
app.post("/:id/vehicles", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = createFleetVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }
  const account = await db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, accountId) });
  if (!account) return c.json({ error: "B2B account not found" }, 404);

  const [vehicle] = await db
    .insert(fleetVehicles)
    .values({ accountId, ...parsed.data })
    .returning();
  return c.json(vehicle, 201);
});

// DELETE /:id/vehicles/:vehicleId — remove a fleet vehicle (account-scoped)
app.delete("/:id/vehicles/:vehicleId", async (c) => {
  const accountId = c.req.param("id");
  const vehicleId = c.req.param("vehicleId");
  const [deleted] = await db
    .delete(fleetVehicles)
    .where(and(eq(fleetVehicles.id, vehicleId), eq(fleetVehicles.accountId, accountId)))
    .returning();
  if (!deleted) return c.json({ error: "Vehicle not found" }, 404);
  return c.json({ success: true });
});

// GET /:id/price-list — negotiated per-service prices for an account
app.get("/:id/price-list", async (c) => {
  const accountId = c.req.param("id");
  const rows = await db
    .select({
      id: b2bPriceList.id,
      serviceId: b2bPriceList.serviceId,
      serviceName: services.name,
      priceCents: b2bPriceList.priceCents,
    })
    .from(b2bPriceList)
    .leftJoin(services, eq(b2bPriceList.serviceId, services.id))
    .where(eq(b2bPriceList.accountId, accountId));
  return c.json({ data: rows });
});

// PUT /:id/price-list — replace an account's negotiated price list (full set)
app.put("/:id/price-list", async (c) => {
  const accountId = c.req.param("id");
  const body = await c.req.json();
  const parsed = setB2bPriceListSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const account = await db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, accountId) });
  if (!account) return c.json({ error: "B2B account not found" }, 404);

  // Validate the referenced services exist.
  const serviceIds = [...new Set(parsed.data.entries.map((e) => e.serviceId))];
  if (serviceIds.length > 0) {
    const found = await db.select({ id: services.id }).from(services).where(inArray(services.id, serviceIds));
    if (found.length !== serviceIds.length) {
      return c.json({ error: "One or more serviceIds do not exist" }, 400);
    }
  }

  const inserted = await db.transaction(async (tx) => {
    await tx.delete(b2bPriceList).where(eq(b2bPriceList.accountId, accountId));
    if (parsed.data.entries.length === 0) return [];
    return tx
      .insert(b2bPriceList)
      .values(parsed.data.entries.map((e) => ({ accountId, serviceId: e.serviceId, priceCents: e.priceCents })))
      .returning();
  });

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "b2b_account.update",
    userId: user.id,
    resourceType: "b2b_account",
    resourceId: accountId,
    details: { companyName: account.companyName, priceListEntries: inserted.length },
    ipAddress,
    userAgent,
  });

  return c.json({ data: inserted });
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
