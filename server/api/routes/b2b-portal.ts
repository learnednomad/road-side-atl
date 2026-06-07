/**
 * B2B self-service portal — account members manage their own bookings, vehicles,
 * estimates, invoices and credit. EVERY query is scoped to the member's
 * c.var.b2bAccountId (set by requireB2bMember); a client-supplied account id is
 * never trusted, so members cannot reach another account's data.
 */
import { Hono } from "hono";
import { db } from "@/db";
import {
  b2bAccounts,
  b2bAccountMembers,
  b2bEstimates,
  b2bCreditTransactions,
  fleetVehicles,
  bookings,
  services,
  invoices,
  users,
  webhookSubscriptions,
} from "@/db/schema";
import crypto from "crypto";
import type { B2bEstimateLine } from "@/db/schema/b2b-estimates";
import { and, eq, desc, ne } from "drizzle-orm";
import { requireB2bMember, requireB2bRole, type B2bMemberEnv } from "../middleware/b2b-member";
import {
  createB2bBookingSchema,
  createFleetVehicleSchema,
  createB2bEstimateSchema,
  convertB2bEstimateSchema,
  addB2bMemberSchema,
  createWebhookSubscriptionSchema,
} from "@/lib/validators";
import { createB2bBooking, priceServiceForAccount, CreditLimitError } from "../lib/b2b-booking";

const app = new Hono<B2bMemberEnv>();
app.use("/*", requireB2bMember);

async function loadAccount(accountId: string) {
  return db.query.b2bAccounts.findFirst({ where: eq(b2bAccounts.id, accountId) });
}

// GET /me — the member's account + role
app.get("/me", async (c) => {
  const accountId = c.get("b2bAccountId");
  const account = await loadAccount(accountId);
  return c.json({ account, role: c.get("b2bRole") });
});

// GET /bookings — account bookings
app.get("/bookings", async (c) => {
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.tenantId, c.get("b2bAccountId")))
    .orderBy(desc(bookings.createdAt))
    .limit(200);
  return c.json({ data: rows });
});

// POST /bookings — create a booking for this account
app.post("/bookings", async (c) => {
  const body = await c.req.json();
  const parsed = createB2bBookingSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const account = await loadAccount(c.get("b2bAccountId"));
  if (!account) return c.json({ error: "Account not found" }, 404);
  if (account.status === "suspended") return c.json({ error: "Account suspended" }, 400);
  const service = await db.query.services.findFirst({ where: eq(services.id, parsed.data.serviceId) });
  if (!service) return c.json({ error: "Service not found" }, 404);
  try {
    const { booking } = await createB2bBooking(account, service, parsed.data);
    return c.json(booking, 201);
  } catch (err) {
    if (err instanceof CreditLimitError) {
      return c.json({ error: "Credit limit exceeded", balanceCents: err.balanceCents, limitCents: err.limitCents }, 402);
    }
    throw err;
  }
});

// GET /vehicles
app.get("/vehicles", async (c) => {
  const rows = await db
    .select()
    .from(fleetVehicles)
    .where(eq(fleetVehicles.accountId, c.get("b2bAccountId")))
    .orderBy(desc(fleetVehicles.createdAt));
  return c.json({ data: rows });
});

// POST /vehicles
app.post("/vehicles", async (c) => {
  const body = await c.req.json();
  const parsed = createFleetVehicleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const [vehicle] = await db
    .insert(fleetVehicles)
    .values({ accountId: c.get("b2bAccountId"), ...parsed.data })
    .returning();
  return c.json(vehicle, 201);
});

// DELETE /vehicles/:id (account-scoped)
app.delete("/vehicles/:id", async (c) => {
  const [deleted] = await db
    .delete(fleetVehicles)
    .where(and(eq(fleetVehicles.id, c.req.param("id")), eq(fleetVehicles.accountId, c.get("b2bAccountId"))))
    .returning();
  if (!deleted) return c.json({ error: "Vehicle not found" }, 404);
  return c.json({ success: true });
});

// GET /estimates
app.get("/estimates", async (c) => {
  const rows = await db
    .select()
    .from(b2bEstimates)
    .where(eq(b2bEstimates.accountId, c.get("b2bAccountId")))
    .orderBy(desc(b2bEstimates.createdAt));
  return c.json({ data: rows });
});

// POST /estimates — build a priced estimate
app.post("/estimates", async (c) => {
  const body = await c.req.json();
  const parsed = createB2bEstimateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const account = await loadAccount(c.get("b2bAccountId"));
  if (!account) return c.json({ error: "Account not found" }, 404);

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
      accountId: c.get("b2bAccountId"),
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

// GET /estimates/:eid
app.get("/estimates/:eid", async (c) => {
  const estimate = await db.query.b2bEstimates.findFirst({
    where: and(eq(b2bEstimates.id, c.req.param("eid")), eq(b2bEstimates.accountId, c.get("b2bAccountId"))),
  });
  if (!estimate) return c.json({ error: "Estimate not found" }, 404);
  return c.json(estimate);
});

// POST /estimates/:eid/convert — convert to bookings (frozen quote price)
app.post("/estimates/:eid/convert", async (c) => {
  const body = await c.req.json();
  const parsed = convertB2bEstimateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const account = await loadAccount(c.get("b2bAccountId"));
  if (!account) return c.json({ error: "Account not found" }, 404);
  if (account.status === "suspended") return c.json({ error: "Account suspended" }, 400);
  const estimate = await db.query.b2bEstimates.findFirst({
    where: and(eq(b2bEstimates.id, c.req.param("eid")), eq(b2bEstimates.accountId, c.get("b2bAccountId"))),
  });
  if (!estimate) return c.json({ error: "Estimate not found" }, 404);

  // Atomically claim before booking so a retry after a partial failure can't
  // double-book / double-charge credit (idempotent convert).
  const [claimed] = await db
    .update(b2bEstimates)
    .set({ status: "converted", updatedAt: new Date() })
    .where(and(eq(b2bEstimates.id, estimate.id), ne(b2bEstimates.status, "converted")))
    .returning();
  if (!claimed) return c.json({ error: "Estimate already converted" }, 400);

  const bookingIds: string[] = [];
  try {
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
          { priceOverrideCents: line.unitPriceCents },
        );
        bookingIds.push(booking.id);
      }
    }
  } catch (err) {
    await db.update(b2bEstimates).set({ convertedBookingIds: bookingIds }).where(eq(b2bEstimates.id, estimate.id));
    if (err instanceof CreditLimitError) {
      return c.json({ error: "Credit limit exceeded", createdBookingIds: bookingIds }, 402);
    }
    throw err;
  }
  const [updated] = await db
    .update(b2bEstimates)
    .set({ convertedBookingIds: bookingIds, updatedAt: new Date() })
    .where(eq(b2bEstimates.id, estimate.id))
    .returning();
  return c.json({ estimate: updated, bookingIds }, 201);
});

// GET /invoices
app.get("/invoices", async (c) => {
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.tenantId, c.get("b2bAccountId")))
    .orderBy(desc(invoices.createdAt))
    .limit(200);
  return c.json({ data: rows });
});

// GET /credit
app.get("/credit", async (c) => {
  const account = await loadAccount(c.get("b2bAccountId"));
  if (!account) return c.json({ error: "Account not found" }, 404);
  const transactions = await db
    .select()
    .from(b2bCreditTransactions)
    .where(eq(b2bCreditTransactions.accountId, c.get("b2bAccountId")))
    .orderBy(desc(b2bCreditTransactions.createdAt))
    .limit(200);
  return c.json({
    currentBalanceCents: account.currentBalanceCents,
    creditLimitCents: account.creditLimitCents,
    availableCreditCents: Math.max(0, account.creditLimitCents - account.currentBalanceCents),
    transactions,
  });
});

// GET /members (owner/manager)
app.get("/members", requireB2bRole("owner", "manager"), async (c) => {
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
    .where(eq(b2bAccountMembers.accountId, c.get("b2bAccountId")));
  return c.json({ data: rows });
});

// POST /members — add a member by email (owner only)
app.post("/members", requireB2bRole("owner"), async (c) => {
  const body = await c.req.json();
  const parsed = addB2bMemberSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (!user) return c.json({ error: "No user with that email" }, 404);
  try {
    const [member] = await db
      .insert(b2bAccountMembers)
      .values({ accountId: c.get("b2bAccountId"), userId: user.id, role: parsed.data.role ?? "member" })
      .returning();
    return c.json(member, 201);
  } catch {
    return c.json({ error: "User is already a member" }, 409);
  }
});

// DELETE /members/:id — remove a member (owner only; can't remove the last owner)
app.delete("/members/:id", requireB2bRole("owner"), async (c) => {
  const accountId = c.get("b2bAccountId");
  const target = await db.query.b2bAccountMembers.findFirst({
    where: and(eq(b2bAccountMembers.id, c.req.param("id")), eq(b2bAccountMembers.accountId, accountId)),
  });
  if (!target) return c.json({ error: "Member not found" }, 404);
  if (target.role === "owner") {
    const owners = await db
      .select({ id: b2bAccountMembers.id })
      .from(b2bAccountMembers)
      .where(and(eq(b2bAccountMembers.accountId, accountId), eq(b2bAccountMembers.role, "owner")));
    if (owners.length <= 1) return c.json({ error: "Cannot remove the last owner" }, 400);
  }
  await db.delete(b2bAccountMembers).where(eq(b2bAccountMembers.id, target.id));
  return c.json({ success: true });
});

// GET /webhooks — list this account's webhook subscriptions (secret redacted)
app.get("/webhooks", requireB2bRole("owner", "manager"), async (c) => {
  const rows = await db
    .select({
      id: webhookSubscriptions.id,
      url: webhookSubscriptions.url,
      events: webhookSubscriptions.events,
      active: webhookSubscriptions.active,
      createdAt: webhookSubscriptions.createdAt,
    })
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.accountId, c.get("b2bAccountId")))
    .orderBy(desc(webhookSubscriptions.createdAt));
  return c.json({ data: rows });
});

// POST /webhooks — register a subscription (owner). Secret returned ONCE.
app.post("/webhooks", requireB2bRole("owner"), async (c) => {
  const body = await c.req.json();
  const parsed = createWebhookSubscriptionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const secret = parsed.data.secret ?? crypto.randomBytes(24).toString("hex");
  const [sub] = await db
    .insert(webhookSubscriptions)
    .values({
      accountId: c.get("b2bAccountId"),
      url: parsed.data.url,
      events: parsed.data.events,
      secret,
    })
    .returning();
  // Return the secret once so the partner can verify HMAC signatures.
  return c.json({ id: sub.id, url: sub.url, events: sub.events, active: sub.active, secret }, 201);
});

// DELETE /webhooks/:id — remove a subscription (owner, account-scoped)
app.delete("/webhooks/:id", requireB2bRole("owner"), async (c) => {
  const [deleted] = await db
    .delete(webhookSubscriptions)
    .where(and(eq(webhookSubscriptions.id, c.req.param("id")), eq(webhookSubscriptions.accountId, c.get("b2bAccountId"))))
    .returning();
  if (!deleted) return c.json({ error: "Subscription not found" }, 404);
  return c.json({ success: true });
});

export default app;
