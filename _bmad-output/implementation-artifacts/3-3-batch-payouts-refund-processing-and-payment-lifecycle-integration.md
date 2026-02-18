# Story 3.3: Batch Payouts, Refund Processing & Payment Lifecycle Integration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Epic: 3 - Payment Operations & Tiered Commission -->
<!-- Story Key: 3-3-batch-payouts-refund-processing-and-payment-lifecycle-integration -->
<!-- Created: 2026-02-17 -->
<!-- FRs: FR20, FR22, FR32 (integration), FR39 (integration) -->
<!-- NFRs: NFR34 (zero double-charge), NFR14 (immutable audit logs), NFR25 (audit for financial mutations) -->
<!-- Dependencies: Story 3.1 (Tiered Commission) - DONE, Story 3.2 (Manual Payment Confirmation) - DONE -->

## Story

As an admin,
I want to process provider payouts individually or in batches and handle refunds with payout adjustments,
so that provider compensation is timely and dispute resolution adjusts financial records correctly.

## Acceptance Criteria

1. **Batch Payout Processing with Audit & Idempotency** - Given multiple confirmed bookings with pending provider payouts, when I select payouts and click "Process Batch", then all selected payouts are marked as paid, and each payout generates an audit entry with `payout.mark_paid`, and idempotency keys prevent double-processing (NFR34).

2. **Individual Payout Processing** - Given a single confirmed booking with a pending payout, when I process the individual payout, then the payout is marked as paid with the commission-adjusted amount.

3. **Partial Refund with Payout Adjustment** - Given a customer dispute on a completed booking, when I initiate a partial refund (e.g., 50%), then the customer refund amount is recorded, and the provider payout is adjusted proportionally, and audit entries are logged for both `payment.refund` and payout adjustment.

4. **Full Refund with Payout Reversal** - Given I initiate a full refund, when the refund is processed, then the full booking amount is refunded to the customer, and the provider payout is reversed entirely.

5. **Clawback on Already-Paid Payout** - Given I initiate a refund on a booking where the provider payout has already been processed, when the refund is confirmed, then a negative payout record is created with type `clawback` linking to the original payout and refund records, and the negative amount is deducted from the provider's next batch payout calculation, and the admin dashboard flags the outstanding provider balance, and audit entries are logged for both `payment.refund` and `payout.clawback`.

6. **FR32 Integration: Completion Notification with Amount Paid** - Given a booking is completed, when the service completion event fires, then a completion notification (SMS + email) is sent to the customer with booking summary and amount paid.

7. **FR39 Integration: Provider Job Notification with Payout Amount** - Given a provider receives a job notification, when the notification displays, then it includes service type, distance, price (with time-block multiplier), and their commission-adjusted payout amount.

## Tasks / Subtasks

- [x] Task 1: Schema changes — add clawback support + refund columns (AC: #3, #4, #5)
  - [x] 1.1 Add `"clawback"` to `payoutStatusEnum` in `db/schema/provider-payouts.ts`
  - [x] 1.2 Add columns to `providerPayouts` table: `payoutType` (text, default "standard"), `originalPayoutId` (self-ref, nullable), `paymentId` (ref to payments, nullable), `notes` (text, nullable)
  - [x] 1.3 Add columns to `payments` table: `refundAmount` (integer, nullable), `refundedAt` (timestamp, nullable), `refundedBy` (ref to users, nullable), `refundReason` (text, nullable)
  - [x] 1.4 Run `npm run db:push` to sync schema changes

- [x] Task 2: Add new audit actions + WSEvent types (AC: #1, #5)
  - [x] 2.1 Add `"payout.clawback"` and `"payout.batch_paid"` to `AuditAction` type union in `server/api/lib/audit-logger.ts`
  - [x] 2.2 Add `"payout:batch_paid"` and `"payment:refunded"` WSEvent types to `server/websocket/types.ts`

- [x] Task 3: Add `initiateRefundSchema` validator (AC: #3, #4)
  - [x] 3.1 Add `initiateRefundSchema` to `lib/validators.ts` — fields: `type` (enum: "partial" | "full"), `amount` (number, int, positive, required when type="partial"), `reason` (string, min 1)
  - [x] 3.2 Export `InitiateRefundInput` type

- [x] Task 4: Add audit logging + WS broadcast to `POST /mark-paid` endpoint (AC: #1, #2)
  - [x] 4.1 In `server/api/routes/admin-payouts.ts`, add imports for `logAudit`, `getRequestInfo`, `broadcastToAdmins`
  - [x] 4.2 After batch update, log `payout.mark_paid` audit entry for each updated payout (fire-and-forget)
  - [x] 4.3 Broadcast `payout:batch_paid` WebSocket event to admins
  - [x] 4.4 Add `AuthEnv` type usage for `c.get("user")` access — update route to use `requireAdmin` middleware that sets user context

- [x] Task 5: Create `POST /refund` endpoint in admin-payouts (AC: #3, #4, #5)
  - [x] 5.1 Validate input with `initiateRefundSchema`
  - [x] 5.2 Look up booking, confirmed payment, and existing payout
  - [x] 5.3 Calculate refund amount: full = payment.amount, partial = validated amount (must be <= payment.amount)
  - [x] 5.4 Update payment record: set `status: "refunded"`, `refundAmount`, `refundedAt`, `refundedBy`, `refundReason`
  - [x] 5.5 Handle payout adjustment based on payout status:
    - If payout status is "pending": adjust payout amount proportionally (partial) or delete/zero it (full) — directly update the payout record
    - If payout status is "paid": create a new clawback payout record with negative amount, `payoutType: "clawback"`, `originalPayoutId` linking to original payout, `paymentId` linking to the payment, `status: "pending"` (will be reconciled in next batch)
    - If no payout exists: just record the refund on payment (no payout adjustment needed)
  - [x] 5.6 Log audit entries: `payment.refund` + `payout.clawback` (if clawback created)
  - [x] 5.7 Broadcast `payment:refunded` WebSocket event to admins

- [x] Task 6: Create `GET /outstanding` endpoint for clawback balances (AC: #5)
  - [x] 6.1 In `server/api/routes/admin-payouts.ts`, add endpoint that aggregates outstanding clawback amounts per provider
  - [x] 6.2 Query: SUM negative payout amounts where `payoutType = "clawback"` and `status = "pending"`, grouped by `providerId`

- [x] Task 7: Update batch mark-paid to deduct outstanding clawbacks (AC: #5)
  - [x] 7.1 Before marking payouts as paid, check if provider has outstanding clawback records
  - [x] 7.2 Auto-settle clawback records when batch payout is processed (mark clawback records as "paid" when their negative amount is covered by new payouts)

- [x] Task 8: Update payouts-table UI for clawback display (AC: #5)
  - [x] 8.1 Update `Payout` interface to include `"clawback"` status and `payoutType` field
  - [x] 8.2 Display clawback rows with negative amount (red text), `clawback` badge variant
  - [x] 8.3 Add outstanding balance warning banner when provider has unresolved clawbacks in summary cards

- [x] Task 9: Enhance completion notification with amount paid — FR32 (AC: #6)
  - [x] 9.1 In status change handler (`PATCH /bookings/:id/status`), when status is "completed", fetch the confirmed payment amount
  - [x] 9.2 Pass amount paid to `notifyStatusChange()` or create enhanced completion notification
  - [x] 9.3 Update `sendStatusUpdate` email/SMS to include amount paid when status is "completed"

- [x] Task 10: Enhance provider job notification with payout amount — FR39 (AC: #7)
  - [x] 10.1 In provider assignment handler, fetch service price, calculate estimated payout using commission rate
  - [x] 10.2 Add `estimatedPayout` and `price` to `provider:job_assigned` WSEvent data
  - [x] 10.3 Update `sendProviderAssignmentSMS()` to include price and estimated payout in the message
  - [x] 10.4 Update `sendProviderAssignment()` email to include price and estimated payout

- [x] Task 11: TypeScript compilation check (AC: all)
  - [x] 11.1 Run `npx tsc --noEmit` — zero errors required

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**Schema changes required — this is the first story in Epic 3 that modifies schema.** Run `npm run db:push` (NOT `db:generate` + `db:migrate`) after making schema changes. Drizzle Kit push is used for schema sync.

**No test framework installed.** Do NOT create test files.

**Integer math for money.** All money values in cents. Commission rates in basis points (10000 = 100%). Do NOT use floating-point for money calculations. Use `Math.round()` for proportional calculations.

**All audit log entries are immutable (NFR14).** Never soft-delete or modify audit records after creation.

### Existing Code You MUST Understand

**Payout system architecture:**

`db/schema/provider-payouts.ts` — Current schema:
```typescript
export const payoutStatusEnum = pgEnum("payout_status", ["pending", "paid"]);
export const providerPayouts = pgTable("provider_payouts", {
  id, providerId, bookingId, amount, status, paidAt, createdAt
});
```
This story adds `"clawback"` to the enum and new columns for clawback linking.

`server/api/routes/admin-payouts.ts` — Current 3 endpoints:
- `GET /` — List payouts with filters (has joins to providers, bookings, services)
- `POST /mark-paid` — Batch mark as paid. **CRITICAL GAP: No audit logging, no WS broadcast.**
- `GET /summary` — Aggregate pending/paid totals. **Needs update for clawback totals.**

`server/api/lib/payout-calculator.ts` — `createPayoutIfEligible(bookingId)`:
- 3-tier priority chain: provider flat_per_job → service commission → provider commission
- Already uses `Math.max(0, providerAmount)` guard
- Fires `createInvoiceForBooking()` after payout creation

**Payment schema:**

`db/schema/payments.ts` — Current schema:
```typescript
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "confirmed", "failed", "refunded"]);
// "refunded" status already exists but no refund columns exist yet
```
This story adds `refundAmount`, `refundedAt`, `refundedBy`, `refundReason` columns.

**Mark-paid endpoint current state (`admin-payouts.ts` lines 58-78):**
```typescript
app.post("/mark-paid", async (c) => {
  const body = await c.req.json();
  const parsed = markPayoutPaidSchema.safeParse(body);
  // ... validates, then:
  const updated = await db.update(providerPayouts)
    .set({ status: "paid", paidAt: now })
    .where(and(inArray(providerPayouts.id, parsed.data.payoutIds), eq(providerPayouts.status, "pending")))
    .returning();
  return c.json({ updated: updated.length, payouts: updated });
});
```
**Missing:** No audit logging, no WebSocket broadcast, no access to `user` context for audit `userId`.

**Completion notification (admin.ts status change handler, lines 277-358):**
```typescript
// Status change to "completed" triggers:
if (parsed.data.status === "completed") {
  await createPayoutIfEligible(bookingId);
  // ... referral SMS logic ...
}
notifyStatusChange(updated, parsed.data.status).catch(() => {});
```
The `notifyStatusChange` function sends generic completion messages ("completed - thank you!") without amount paid. FR32 requires including amount paid.

**Provider assignment notification (admin.ts lines 240-253):**
```typescript
notifyProviderAssigned(updated, provider).catch(() => {});
broadcastToProvider(provider.userId, {
  type: "provider:job_assigned",
  data: { bookingId, providerId, contactName, address },
});
```
FR39 requires: service type, distance, price (with time-block multiplier), and commission-adjusted payout amount. Currently only sends bookingId, providerId, contactName, address.

**Audit actions already exist:** `payout.create`, `payout.mark_paid`, `payment.refund` are already defined in `AuditAction`. Story adds: `payout.clawback`, `payout.batch_paid`.

**WSEvent types:** Currently no payout-related or refund-related WS events. Story adds: `payout:batch_paid`, `payment:refunded`.

**Payouts table UI (`components/admin/payouts-table.tsx`):**
- Full client component with checkbox selection, batch mark-paid, filters, pagination, CSV export
- Payout interface only knows `status: "pending" | "paid"` — needs `"clawback"` support
- Does NOT display `payoutType` — needs to show standard vs clawback rows differently
- `markPaid()` function calls `POST /mark-paid` then optimistically updates local state

**Fire-and-forget pattern for admin routes:**
```typescript
notifySomething(data).catch(() => {});    // notifications
logAudit({ action, userId, ... });         // audit (no await)
broadcastToAdmins({ type, data });         // WebSocket (no await)
```

**Validator pattern:**
```typescript
export const someSchema = z.object({ ... });
export type SomeInput = z.infer<typeof someSchema>;
```
Import from `"zod/v4"` (NOT `"zod"`).

### Exact Implementation Specifications

**1. Schema: `db/schema/provider-payouts.ts` — add clawback support:**

```typescript
export const payoutStatusEnum = pgEnum("payout_status", ["pending", "paid", "clawback"]);

export const providerPayouts = pgTable("provider_payouts", {
  // ... existing columns ...
  payoutType: text("payoutType").default("standard").notNull(), // "standard" | "clawback"
  originalPayoutId: text("originalPayoutId"), // self-ref for clawback linking
  paymentId: text("paymentId"), // ref to payment that triggered this payout/clawback
  notes: text("notes"), // admin notes (e.g., refund reason)
});
```

Note: Use `text()` for `payoutType` rather than creating a new enum — simpler and more flexible. Self-referencing foreign keys in Drizzle are tricky, so use plain `text()` for `originalPayoutId` without `.references()`.

**2. Schema: `db/schema/payments.ts` — add refund columns:**

```typescript
export const payments = pgTable("payments", {
  // ... existing columns ...
  refundAmount: integer("refundAmount"), // cents, null = no refund
  refundedAt: timestamp("refundedAt", { mode: "date" }),
  refundedBy: text("refundedBy").references(() => users.id),
  refundReason: text("refundReason"),
});
```

**3. Audit actions (`server/api/lib/audit-logger.ts`) — add:**
```typescript
| "payout.clawback"
| "payout.batch_paid"
```

**4. WSEvent types (`server/websocket/types.ts`) — add:**
```typescript
| { type: "payout:batch_paid"; data: { payoutIds: string[]; count: number } }
| { type: "payment:refunded"; data: { paymentId: string; bookingId: string; refundType: string; refundAmount: number } }
```

**5. Refund validator (`lib/validators.ts`) — add:**
```typescript
export const initiateRefundSchema = z.object({
  bookingId: z.string().uuid("Invalid booking"),
  type: z.enum(["partial", "full"]),
  amount: z.number().int().positive().optional(), // required for partial, cents
  reason: z.string().min(1, "Refund reason is required"),
}).refine(
  (data) => data.type === "full" || (data.type === "partial" && data.amount !== undefined && data.amount > 0),
  { message: "Amount is required for partial refunds" }
);
export type InitiateRefundInput = z.infer<typeof initiateRefundSchema>;
```

**6. Enhanced `POST /mark-paid` endpoint (`admin-payouts.ts`):**

Add after existing update logic:
```typescript
const user = c.get("user");
const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

// Audit each payout individually (NFR14 - immutable per-record)
for (const payout of updated) {
  logAudit({
    action: "payout.mark_paid",
    userId: user.id,
    resourceType: "payout",
    resourceId: payout.id,
    details: { providerId: payout.providerId, bookingId: payout.bookingId, amount: payout.amount },
    ipAddress,
    userAgent,
  });
}

// Broadcast to admins
broadcastToAdmins({
  type: "payout:batch_paid",
  data: { payoutIds: updated.map((p) => p.id), count: updated.length },
});
```

**7. `POST /refund` endpoint logic (add to `admin-payouts.ts`):**

```typescript
app.post("/refund", async (c) => {
  const body = await c.req.json();
  const parsed = initiateRefundSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { bookingId, type: refundType, amount: requestedAmount, reason } = parsed.data;
  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  // Find confirmed payment for this booking
  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.bookingId, bookingId), eq(payments.status, "confirmed")),
  });
  if (!payment) {
    return c.json({ error: "No confirmed payment found for this booking" }, 404);
  }

  // Already refunded guard
  if (payment.refundAmount) {
    return c.json({ error: "Payment already refunded" }, 409);
  }

  // Calculate refund amount
  const refundAmount = refundType === "full" ? payment.amount : requestedAmount!;
  if (refundAmount > payment.amount) {
    return c.json({ error: "Refund amount exceeds payment amount" }, 400);
  }

  // Update payment with refund info
  const [updatedPayment] = await db.update(payments)
    .set({
      status: "refunded",
      refundAmount,
      refundedAt: new Date(),
      refundedBy: user.id,
      refundReason: reason,
    })
    .where(eq(payments.id, payment.id))
    .returning();

  // Handle payout adjustment
  const existingPayout = await db.query.providerPayouts.findFirst({
    where: eq(providerPayouts.bookingId, bookingId),
  });

  let clawbackPayout = null;

  if (existingPayout) {
    if (existingPayout.status === "pending") {
      // Pending payout: adjust directly
      if (refundType === "full") {
        // Full refund: zero out pending payout
        await db.update(providerPayouts)
          .set({ amount: 0, notes: `Zeroed: full refund - ${reason}` })
          .where(eq(providerPayouts.id, existingPayout.id));
      } else {
        // Partial refund: reduce proportionally
        const refundRatio = refundAmount / payment.amount;
        const payoutReduction = Math.round(existingPayout.amount * refundRatio);
        const newPayoutAmount = Math.max(0, existingPayout.amount - payoutReduction);
        await db.update(providerPayouts)
          .set({ amount: newPayoutAmount, notes: `Adjusted: partial refund (${refundRatio * 100}%) - ${reason}` })
          .where(eq(providerPayouts.id, existingPayout.id));
      }
    } else if (existingPayout.status === "paid") {
      // Already paid: create clawback record
      const clawbackAmount = refundType === "full"
        ? existingPayout.amount
        : Math.round(existingPayout.amount * (refundAmount / payment.amount));

      [clawbackPayout] = await db.insert(providerPayouts)
        .values({
          providerId: existingPayout.providerId,
          bookingId,
          amount: -clawbackAmount, // negative amount
          status: "pending", // pending settlement
          payoutType: "clawback",
          originalPayoutId: existingPayout.id,
          paymentId: payment.id,
          notes: `Clawback: ${refundType} refund - ${reason}`,
        })
        .returning();

      // Audit clawback
      logAudit({
        action: "payout.clawback",
        userId: user.id,
        resourceType: "payout",
        resourceId: clawbackPayout.id,
        details: {
          originalPayoutId: existingPayout.id,
          clawbackAmount,
          refundType,
          bookingId,
        },
        ipAddress,
        userAgent,
      });
    }
  }

  // Audit refund
  logAudit({
    action: "payment.refund",
    userId: user.id,
    resourceType: "payment",
    resourceId: payment.id,
    details: {
      bookingId,
      refundType,
      refundAmount,
      reason,
      hasClawback: !!clawbackPayout,
    },
    ipAddress,
    userAgent,
  });

  // Broadcast to admins
  broadcastToAdmins({
    type: "payment:refunded",
    data: { paymentId: payment.id, bookingId, refundType, refundAmount },
  });

  return c.json({
    refund: updatedPayment,
    payout: existingPayout ? { adjusted: true, clawback: clawbackPayout } : null,
  });
});
```

**8. `GET /outstanding` endpoint:**

```typescript
app.get("/outstanding", async (c) => {
  const outstanding = await db
    .select({
      providerId: providerPayouts.providerId,
      providerName: providers.name,
      outstandingAmount: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      clawbackCount: sql<number>`count(*)`,
    })
    .from(providerPayouts)
    .innerJoin(providers, eq(providerPayouts.providerId, providers.id))
    .where(and(
      eq(providerPayouts.payoutType, "clawback"),
      eq(providerPayouts.status, "pending")
    ))
    .groupBy(providerPayouts.providerId, providers.name);

  return c.json(outstanding.map((r) => ({
    providerId: r.providerId,
    providerName: r.providerName,
    outstandingAmount: Math.abs(Number(r.outstandingAmount)), // positive number for display
    clawbackCount: Number(r.clawbackCount),
  })));
});
```

**9. Update summary endpoint for clawback totals:**

Add to the existing summary SQL:
```typescript
totalClawback: sql<number>`coalesce(sum(case when ${providerPayouts.payoutType} = 'clawback' and ${providerPayouts.status} = 'pending' then abs(${providerPayouts.amount}) else 0 end), 0)`,
clawbackCount: sql<number>`count(case when ${providerPayouts.payoutType} = 'clawback' and ${providerPayouts.status} = 'pending' then 1 end)`,
```

**10. FR32 — Enhanced completion notification:**

In `server/api/routes/admin.ts`, status change handler where `status === "completed"`:
```typescript
if (parsed.data.status === "completed") {
  await createPayoutIfEligible(bookingId);

  // Fetch confirmed payment amount for completion notification (FR32)
  const confirmedPayment = await db.query.payments.findFirst({
    where: and(eq(payments.bookingId, bookingId), eq(payments.status, "confirmed")),
  });
  const amountPaid = confirmedPayment?.amount;

  // ... existing referral SMS logic ...
}

// Enhanced status notification with amount paid
notifyStatusChange(updated, parsed.data.status, amountPaid).catch(() => {});
```

Update `notifyStatusChange` signature in `lib/notifications/index.ts`:
```typescript
export async function notifyStatusChange(booking: BookingInfo, newStatus: string, amountPaid?: number) {
```

Update `sendStatusUpdate` in email.ts and `sendStatusUpdateSMS` in sms.ts to include amount paid when status is "completed":
```typescript
completed: amountPaid
  ? `completed. Amount paid: ${formatPrice(amountPaid)}. Thank you!`
  : "completed - thank you!",
```

**11. FR39 — Enhanced provider job notification:**

In `server/api/routes/admin.ts`, provider assignment handler (around line 230):
```typescript
// Fetch service for price + commission data (FR39)
const service = await db.query.services.findFirst({
  where: eq(services.id, updated.serviceId),
});
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

broadcastToProvider(provider.userId, {
  type: "provider:job_assigned",
  data: {
    bookingId,
    providerId: provider.id,
    contactName: updated.contactName,
    address: (updated.location as { address: string }).address,
    serviceName: service?.name || "Service",
    estimatedPrice,
    estimatedPayout,
  },
});
```

Update `provider:job_assigned` WSEvent type:
```typescript
| { type: "provider:job_assigned"; data: { bookingId: string; providerId: string; contactName: string; address: string; serviceName?: string; estimatedPrice?: number; estimatedPayout?: number } }
```

Update provider assignment SMS/email in sms.ts and email.ts to include price and payout info.

### Project Structure Notes

**Files to CREATE:**
None — all changes go into existing files.

**Files to MODIFY:**

| File | What to Change |
|---|---|
| `db/schema/provider-payouts.ts` | Add `"clawback"` to payoutStatusEnum, add `payoutType`, `originalPayoutId`, `paymentId`, `notes` columns |
| `db/schema/payments.ts` | Add `refundAmount`, `refundedAt`, `refundedBy`, `refundReason` columns |
| `server/api/lib/audit-logger.ts` | Add `"payout.clawback"` and `"payout.batch_paid"` to AuditAction type |
| `server/websocket/types.ts` | Add `"payout:batch_paid"` and `"payment:refunded"` WSEvent types, extend `provider:job_assigned` data |
| `lib/validators.ts` | Add `initiateRefundSchema` and `InitiateRefundInput` type |
| `server/api/routes/admin-payouts.ts` | Add audit logging + WS broadcast to POST /mark-paid, add POST /refund endpoint, add GET /outstanding endpoint, update GET /summary for clawback totals |
| `components/admin/payouts-table.tsx` | Add clawback status display, negative amount rendering, outstanding balance warning |
| `server/api/routes/admin.ts` | Enhance completion notification with amount paid (FR32), enhance provider assignment notification with price/payout (FR39) |
| `lib/notifications/index.ts` | Update `notifyStatusChange` to accept optional `amountPaid` parameter |
| `lib/notifications/email.ts` | Update `sendStatusUpdate` for completion amount, update `sendProviderAssignment` for price/payout |
| `lib/notifications/sms.ts` | Update `sendStatusUpdateSMS` for completion amount, update `sendProviderAssignmentSMS` for price/payout |

**Files NOT to create:**
- NO `server/api/routes/refunds.ts` — refund endpoint lives in existing `admin-payouts.ts` (keeps payout + refund logic colocated)
- NO `lib/refund-calculator.ts` — refund math is simple enough to inline in the endpoint
- NO `components/admin/refund-dialog.tsx` — UI for initiating refunds is out of scope for this story (admin uses API directly or existing UI is extended minimally)
- NO new schema files — all changes are column additions to existing tables
- NO test files

**Files NOT to modify:**
- NO changes to `server/api/lib/payout-calculator.ts` — payout creation logic remains the same; clawback is separate
- NO changes to `server/api/routes/receipts.ts` — receipt endpoints are unrelated to refund flow
- NO changes to `lib/receipts/generate-receipt.ts` — receipt generator is unrelated
- NO changes to `server/api/index.ts` — admin-payouts route is already mounted
- NO changes to `db/schema/index.ts` — no new schema files added

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a separate refund route module | Add refund endpoint to existing `admin-payouts.ts` |
| Use floating-point for refund ratio calculations | Use `Math.round()` with integer math: `Math.round(amount * ratio)` |
| Delete payout records on full refund | Zero out pending payouts or create clawback records for paid ones |
| Await notification/audit calls in request handlers | Fire-and-forget: `.catch(() => {})` for notifications, no await for `logAudit`/`broadcastToAdmins` |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use `.references()` for self-referencing `originalPayoutId` | Use plain `text()` column — Drizzle self-refs are problematic |
| Add `updatedAt` to payments table | Payments table doesn't have `updatedAt` — don't add it, use `refundedAt` for refund timestamp |
| Create a separate clawback settlement cron job | Settle clawbacks during batch mark-paid (inline deduction) |
| Break the existing mark-paid API contract | Add fields to response, don't change existing shape — UI expects `{ updated, payouts }` |
| Send refund notification to customer | Refund notification is out of scope — admin handles customer communication externally |
| Modify the `createPayoutIfEligible` function | Clawback is a separate record, not a modification to the original payout creation logic |

### Previous Story Intelligence

**From Story 3.2 (Manual Payment Confirmation & Receipt Generation) — DONE:**
- Idempotency guard pattern: `wasAlreadyConfirmed = existingPayment.status === "confirmed"` — reuse for refund (check `payment.refundAmount`)
- `PAYMENT_METHOD_DISPLAY` map in email.ts and sms.ts for human-friendly payment method names
- Both confirm endpoints (PATCH + POST) now have full receipt + payout wiring
- Fire-and-forget for all notifications, audit, broadcasts
- TypeScript compilation is the only verification method

**From Story 3.1 (Tiered Commission Configuration & Calculation) — DONE:**
- Commission calculation 3-tier priority: provider flat → service commission → provider commission
- Service-level `commissionRate` column on services table
- Route ordering: specific routes BEFORE parameterized `/:id` routes — important for `admin-payouts.ts` when adding `/refund` and `/outstanding` before any `/:id` patterns
- `AuthEnv` type declared locally in route files
- `getRequestInfo(c.req.raw)` for audit logging

**Key learnings from previous code reviews:**
- Always consolidate DB queries — avoid fetching the same record multiple times
- Payment method display names matter for user-facing content
- Idempotency guards prevent duplicate operations (receipts, payouts, now refunds)

### Git Intelligence

**Recent commits:**
```
bb129e3 Add manual payment confirmation receipt emails, SMS notifications, and payout gap fix
047d30c Add tiered commission configuration, service-level payout calculation, and admin commission UI
b12c101 Add storm mode activation, time-block pricing config UI, and booking price override
```

**Patterns observed:**
- Imperative present tense commit messages ("Add", "Fix")
- Features bundled in single commits
- Schema changes + API + UI in same commit (when they're part of the same story)

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. **TypeScript compilation**: `npx tsc --noEmit` passes with zero errors.
2. **Schema sync**: `npm run db:push` completes without errors.
3. **Batch mark-paid with audit**: Select multiple pending payouts, click "Mark as Paid" — verify `payout.mark_paid` audit entries are created for each.
4. **Partial refund (pending payout)**: Initiate a 50% refund on a booking with pending payout — verify payment gets `refundAmount`, payout amount is reduced proportionally.
5. **Full refund (pending payout)**: Initiate full refund — verify payment is "refunded", payout amount is zeroed.
6. **Clawback (paid payout)**: Initiate refund on a booking where payout was already paid — verify negative clawback payout record is created with `payoutType: "clawback"`, `originalPayoutId` linking to original.
7. **Outstanding balance**: After creating clawback, verify `GET /outstanding` shows the provider with outstanding amount.
8. **Idempotency**: Try to refund the same payment twice — verify 409 Conflict response.
9. **FR32 completion notification**: Change booking status to "completed" — verify customer SMS/email includes amount paid.
10. **FR39 provider notification**: Assign a provider to a booking — verify WS event includes `estimatedPrice` and `estimatedPayout`.
11. **Clawback settlement**: After creating a clawback, process a batch payout for that provider — verify clawback is settled.
12. **UI clawback display**: Verify payouts table shows clawback rows with negative amount in red, appropriate badge.

### Dependencies and Scope

**This story depends on:**
- Story 3.1 (Tiered Commission) — DONE. Commission calculation and service-level rates.
- Story 3.2 (Manual Payment Confirmation) — DONE. Receipt notifications, confirm endpoint payout fix.

**This story does NOT block any other stories** in the current sprint. It completes Epic 3.

**This story does NOT include:**
- Customer-facing refund request UI (admin-only operation)
- Stripe refund processing (Stripe handles its own refunds via dashboard)
- Refund notification to customer (admin communicates externally)
- Provider-facing clawback notification (future enhancement)
- Admin refund dialog UI component (admin uses API directly or payouts page is extended in future story)

**Scope boundary:** Add audit logging + WS broadcast to existing batch mark-paid. Create refund endpoint with partial/full/clawback support. Add outstanding balance tracking. Enhance completion notification with amount paid (FR32). Enhance provider job notification with payout amount (FR39). Schema changes for refund columns and clawback support.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.3]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: server/api/routes/admin-payouts.ts - 3 existing endpoints (mark-paid, list, summary)]
- [Source: server/api/routes/admin.ts#PATCH /bookings/:id/status - completion notification (FR32)]
- [Source: server/api/routes/admin.ts#provider assignment handler - job notification (FR39)]
- [Source: db/schema/provider-payouts.ts - payoutStatusEnum + providerPayouts table]
- [Source: db/schema/payments.ts - paymentStatusEnum + payments table]
- [Source: server/api/lib/payout-calculator.ts - createPayoutIfEligible 3-tier priority chain]
- [Source: server/api/lib/audit-logger.ts - AuditAction type (add payout.clawback, payout.batch_paid)]
- [Source: server/websocket/types.ts - WSEvent type (add payout:batch_paid, payment:refunded)]
- [Source: lib/validators.ts - existing validators (add initiateRefundSchema)]
- [Source: lib/notifications/index.ts - notifyStatusChange (enhance for FR32)]
- [Source: lib/notifications/email.ts - sendStatusUpdate, sendProviderAssignment (enhance)]
- [Source: lib/notifications/sms.ts - sendStatusUpdateSMS, sendProviderAssignmentSMS (enhance)]
- [Source: components/admin/payouts-table.tsx - PayoutsTable component (add clawback display)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript compilation passed with zero errors after all 11 tasks implemented
- `npm run db:push --force` succeeded — schema changes synced (audit_logs table was recreated by runtime)
- Payouts page server component required clawback summary fields update (caught by tsc)

### Completion Notes List

- Task 1: Added `"clawback"` to `payoutStatusEnum`. Added `payoutType`, `originalPayoutId`, `paymentId`, `notes` columns to `providerPayouts`. Added `refundAmount`, `refundedAt`, `refundedBy`, `refundReason` columns to `payments`. Schema pushed via `db:push`.
- Task 2: Added `"payout.clawback"` and `"payout.batch_paid"` to AuditAction type. Added `payout:batch_paid` and `payment:refunded` WSEvent types. Extended `provider:job_assigned` WSEvent data with optional `serviceName`, `estimatedPrice`, `estimatedPayout`.
- Task 3: Added `initiateRefundSchema` validator with `.refine()` for conditional amount validation on partial refunds. Exported `InitiateRefundInput` type.
- Task 4: Added `logAudit`, `getRequestInfo`, `broadcastToAdmins` imports to admin-payouts.ts. Batch mark-paid now logs `payout.mark_paid` per payout and broadcasts `payout:batch_paid` to admins.
- Task 5: Created `POST /refund` endpoint — validates with `initiateRefundSchema`, idempotency guard (already refunded = 409), calculates refund amount, updates payment record, handles 3 payout scenarios (pending=adjust, paid=clawback, none=skip), logs `payment.refund` + `payout.clawback` audits, broadcasts `payment:refunded`.
- Task 6: Created `GET /outstanding` endpoint — aggregates outstanding clawback amounts per provider using SUM + GROUP BY on clawback/pending records. Returns `outstandingAmount` (absolute value) and `clawbackCount`.
- Task 7: Mark-paid now auto-settles outstanding clawback records for providers in the batch. After marking standard payouts paid, finds and settles all pending clawback records for those provider IDs.
- Task 8: Updated `Payout` interface with `"clawback"` status and `payoutType` field. Clawback rows show negative amounts in red, `destructive` badge variant. Added outstanding clawback warning banner with AlertTriangle icon. Added "Clawback" filter option. Updated CSV export to include Type column. Summary cards exclude clawback from pending totals.
- Task 9: FR32 — Status change handler fetches confirmed payment amount when booking completed. Passes `amountPaid` to `notifyStatusChange()`. Email/SMS now show "Amount paid: $X.XX" in completion messages.
- Task 10: FR39 — Provider assignment handler now fetches service data and calculates estimated payout using 3-tier commission priority chain. WS broadcast includes `serviceName`, `estimatedPrice`, `estimatedPayout`. Provider assignment email includes "Your Estimated Payout" line item. Provider assignment SMS includes price and payout info.
- Task 11: `npx tsc --noEmit` passed with zero errors. Fixed payouts page.tsx to include clawback summary fields.

### File List

**Modified:**
- `db/schema/provider-payouts.ts` — added `"clawback"` to payoutStatusEnum, added `payoutType`, `originalPayoutId`, `paymentId`, `notes` columns
- `db/schema/payments.ts` — added `refundAmount`, `refundedAt`, `refundedBy`, `refundReason` columns
- `server/api/lib/audit-logger.ts` — added `"payout.clawback"` and `"payout.batch_paid"` to AuditAction type
- `server/websocket/types.ts` — added `payout:batch_paid`, `payment:refunded` WSEvent types, extended `provider:job_assigned` data
- `lib/validators.ts` — added `initiateRefundSchema` and `InitiateRefundInput` type
- `server/api/routes/admin-payouts.ts` — added audit+WS to mark-paid, added POST /refund with clawback logic, added GET /outstanding, updated GET /summary for clawback totals, added clawback auto-settlement on batch paid
- `components/admin/payouts-table.tsx` — added clawback status/type display, negative amount rendering, outstanding balance warning, clawback filter option, CSV type column
- `app/(admin)/admin/payouts/page.tsx` — updated summary query for clawback totals, passed new fields to PayoutsTable
- `server/api/routes/admin.ts` — FR32: fetch payment amount on completion, pass to notifyStatusChange. FR39: calculate estimated payout on provider assignment, include in WS broadcast and notifications
- `lib/notifications/index.ts` — updated `notifyStatusChange` to accept optional `amountPaid`, updated `notifyProviderAssigned` to accept optional price/payout
- `lib/notifications/email.ts` — updated `sendStatusUpdate` for completion amount, updated `sendProviderAssignment` for estimated payout
- `lib/notifications/sms.ts` — updated `sendStatusUpdateSMS` for completion amount, updated `sendProviderAssignmentSMS` for price/payout

## Senior Developer Review

**Reviewer:** Claude Opus 4.6
**Date:** 2026-02-18
**Result:** PASS (0 HIGH, 2 MEDIUM fixed, 2 LOW noted)

### Issues Found & Fixed

**MEDIUM #1 — Mark-paid + clawback settlement not atomic** (`admin-payouts.ts:60-131`)
Two separate DB operations could leave clawbacks unsettled if second query failed. Fixed: wrapped both in `db.transaction()`.

**MEDIUM #2 — UI stale state after clawback settlement** (`payouts-table.tsx:106-130`)
Optimistic update only updated standard payouts; settled clawbacks remained "pending" in UI. Fixed: destructure `settledClawbacks` from response, update clawback records for affected providers in local state, show settlement count in toast.

### LOW Issues (Noted, Not Fixed)

- Summary `paidCount` includes settled clawback records — count slightly inflated but dollar totals correct.
- FR39 AC mentions "distance" in provider notification — intentionally scoped out by SM in task definitions.
