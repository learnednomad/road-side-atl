# Story 3.2: Manual Payment Confirmation & Receipt Generation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Epic: 3 - Payment Operations & Tiered Commission -->
<!-- Story Key: 3-2-manual-payment-confirmation-and-receipt-generation -->
<!-- Created: 2026-02-16 -->
<!-- FRs: FR18, FR21 -->
<!-- NFRs: NFR50 (email CAN-SPAM compliance) -->
<!-- Dependencies: Story 3.1 (Tiered Commission) - DONE -->

## Story

As an admin,
I want to confirm manual payment receipts (CashApp, Zelle, Cash) and automatically send customer receipts,
so that the payment lifecycle completes reliably and customers have proof of payment.

## Acceptance Criteria

1. **CashApp Payment Confirmation with Receipt** - Given a completed booking with payment method "cashapp", when I confirm payment receipt in the admin dashboard, then the booking payment status updates to "paid" (confirmed), and a payment receipt email is generated and sent to the customer, and an audit entry is logged with `payment.confirm`.

2. **Cash Payment Confirmation with Receipt** - Given a completed booking with payment method "cash", when I confirm the cash payment, then the same confirmation and receipt flow executes (status → confirmed, receipt email sent, audit logged).

3. **Receipt Email Content** - Given I confirm a payment, when the receipt email is sent, then it includes: booking ID, service type, amount paid, payment method, date, and provider name, and the email includes an unsubscribe link (NFR50 CAN-SPAM compliance).

## Tasks / Subtasks

- [x] Task 1: Add `payment.receipt_sent` audit action (AC: #1, #2)
  - [x] 1.1 Add `"payment.receipt_sent"` to `AuditAction` type union in `server/api/lib/audit-logger.ts`

- [x] Task 2: Create `sendPaymentReceiptEmail()` function (AC: #3)
  - [x] 2.1 Add `sendPaymentReceiptEmail()` to `lib/notifications/email.ts` — accepts customer email, customer name, booking ID, service name, amount paid (cents), payment method, payment date, provider name
  - [x] 2.2 Email content: branded HTML matching existing email patterns with booking ID, service type, amount formatted via `formatPrice()`, payment method, date, provider name
  - [x] 2.3 Include unsubscribe link per NFR50: `<a href="${APP_URL}/unsubscribe">unsubscribe here</a>` matching the exact pattern in `sendObservationFollowUpEmail()`

- [x] Task 3: Create `sendPaymentReceiptSMS()` function (AC: #1, #2)
  - [x] 3.1 Add `sendPaymentReceiptSMS()` to `lib/notifications/sms.ts` — short confirmation message with booking ID, amount, and payment method

- [x] Task 4: Create `notifyPaymentConfirmed()` coordinator (AC: #1, #2, #3)
  - [x] 4.1 Add `notifyPaymentConfirmed()` to `lib/notifications/index.ts` — uses `Promise.allSettled()` to send both email and SMS
  - [x] 4.2 Import `sendPaymentReceiptEmail` and `sendPaymentReceiptSMS` into the coordinator

- [x] Task 5: Wire receipt notifications into `PATCH /payments/:id/confirm` endpoint (AC: #1, #2)
  - [x] 5.1 In `server/api/routes/admin.ts`, after successful payment confirmation, fetch the full booking + service + provider data needed for the receipt
  - [x] 5.2 Call `notifyPaymentConfirmed()` fire-and-forget (`.catch(() => {})`)
  - [x] 5.3 Log `payment.receipt_sent` audit action fire-and-forget after notification dispatch
  - [x] 5.4 Call `createPayoutIfEligible(bookingId)` — this endpoint currently does NOT trigger payout creation (unlike the POST endpoint), which is a gap

- [x] Task 6: Wire receipt notifications into `POST /bookings/:id/confirm-payment` endpoint (AC: #1, #2)
  - [x] 6.1 In `server/api/routes/admin.ts`, after successful payment creation, fetch the full booking + service + provider data needed for the receipt
  - [x] 6.2 Call `notifyPaymentConfirmed()` fire-and-forget
  - [x] 6.3 Log `payment.receipt_sent` audit action fire-and-forget

- [x] Task 7: Verify admin UI payment confirmation flow (AC: #1, #2)
  - [x] 7.1 Verify `components/admin/bookings-table.tsx` confirm-payment dialog calls `POST /bookings/:id/confirm-payment` correctly — this already works
  - [x] 7.2 TypeScript compilation check (`npx tsc --noEmit`)

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**No new schema changes needed.** All required database columns exist:
- `payments.status` (confirmed/pending/failed/refunded) — already used for payment confirmation
- `payments.confirmedAt`, `payments.confirmedBy` — already populated by confirm endpoints
- `bookings.finalPrice` — already set by the POST confirm-payment endpoint
- No migration required for this story.

**No test framework installed.** Do NOT create test files.

**Two confirm-payment endpoints exist — both need receipt wiring:**

1. **`PATCH /payments/:id/confirm`** (admin.ts lines 362-419): Updates an existing payment record to "confirmed". Currently does NOT call `createPayoutIfEligible()`. This is a gap — this story MUST add the payout call.
2. **`POST /bookings/:id/confirm-payment`** (admin.ts lines 422-483): Creates a new payment record as "confirmed" for a booking. Already calls `createPayoutIfEligible()`.

Both endpoints already:
- Set `status: "confirmed"`, `confirmedAt: new Date()`, `confirmedBy: user.id`
- Log `payment.confirm` audit action
- Increment clean transaction count for trust tier

Neither endpoint currently sends receipt email/SMS — this story adds that.

**PATCH endpoint payout gap.** The `PATCH /payments/:id/confirm` endpoint does NOT call `createPayoutIfEligible()` after confirming payment. The `POST /bookings/:id/confirm-payment` does. This story must add `createPayoutIfEligible(existingPayment.bookingId)` to the PATCH endpoint to ensure consistent behavior. This is essential because if a payment record already exists (e.g., created by Stripe webhook in pending state, then manually confirmed), the payout should still be created.

### Existing Code You MUST Understand

**Receipt generation already exists** — `lib/receipts/generate-receipt.ts`:
```typescript
export function generateReceiptHTML(data: ReceiptData): string {
  // Self-contained HTML with embedded CSS
  // Includes: booking ID, service name, customer info, vehicle info, location,
  // estimated price, final price, payment method, payment date, provider name
}
```
This is used by the public receipt endpoints at `/api/receipts/:bookingId`. The receipt HTML is comprehensive — you do NOT need to recreate it. The email can either:
- (A) Embed a simplified receipt inline in the email HTML (preferred — matches existing email patterns)
- (B) Link to the public receipt URL

Use option (A) — a simplified inline receipt matching the existing email style. The full receipt is available at `/api/receipts/:bookingId` if the customer wants the detailed version.

**Public receipt routes already exist** — `server/api/routes/receipts.ts`:
- `GET /api/receipts/:bookingId` — returns receipt HTML
- `GET /api/receipts/:bookingId/download` — returns receipt as downloadable HTML file
These are PUBLIC (no auth required) and can be linked from the receipt email.

**Email pattern** — `lib/notifications/email.ts`:
```typescript
function getResend(): Resend | null { ... } // Graceful degradation if no API key
const FROM = process.env.RESEND_FROM || "noreply@roadsideatl.com";

// All send functions follow this pattern:
export async function sendSomethingEmail(params...) {
  const resend = getResend();
  if (!resend) return; // Graceful degradation
  await resend.emails.send({ from: FROM, to, subject, html });
}
```
- 9 existing send functions — follow the exact same pattern
- Unsubscribe link pattern (NFR50): `<p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/unsubscribe">unsubscribe here</a>.</p>`
- Uses `formatPrice()` from `@/lib/utils` for money formatting

**SMS pattern** — `lib/notifications/sms.ts`:
```typescript
export async function sendSomethingSMS(phone: string, ...) {
  await sendSMS(phone, `RoadSide ATL: ...message... Reply STOP to opt out.`);
}
```
- 8 existing send functions
- Built-in rate limiting (1 SMS per phone per 60s)
- "Reply STOP to opt out." suffix for compliance

**Notification coordinator pattern** — `lib/notifications/index.ts`:
```typescript
export async function notifySomething(params...) {
  await Promise.allSettled([
    sendSomethingEmail(emailParams),
    sendSomethingSMS(smsParams),
  ]);
}
```
- 9 existing coordinator functions
- Always uses `Promise.allSettled()` to prevent one failure from blocking the other
- Some coordinators only send email (e.g., `notifyInspectionReport`) or only SMS (e.g., `notifyReferralLink`)

**Admin route fire-and-forget pattern:**
```typescript
// Notifications: call .catch(() => {}) — do NOT await in request handler
notifySomething(data).catch(() => {});

// Audit logging: fire-and-forget (no await)
logAudit({ action, userId, resourceType, resourceId, details, ipAddress, userAgent });

// WebSocket broadcasts: fire-and-forget (no await)
broadcastToAdmins({ type, data });
```

**Confirm payment schemas** — `lib/validators.ts`:
```typescript
export const confirmPaymentSchema = z.object({
  method: z.enum(["cash", "cashapp", "zelle"]),
  amount: z.number().int().positive().optional(),
});
```
No changes needed to the validator.

**Payment schema** — `db/schema/payments.ts`:
```typescript
export const payments = pgTable("payments", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  bookingId: text("bookingId").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // cents
  method: paymentMethodEnum("method").notNull(), // "cash" | "cashapp" | "zelle" | "stripe"
  status: paymentStatusEnum("status").default("pending").notNull(),
  stripeSessionId: text("stripeSessionId"),
  confirmedAt: timestamp("confirmedAt", { mode: "date" }),
  confirmedBy: text("confirmedBy").references(() => users.id),
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
```
Note: No `updatedAt` column on payments table.

**Bookings-table UI** — `components/admin/bookings-table.tsx`:
```typescript
async function confirmPayment(bookingId: string, method: PaymentMethod) {
  const res = await fetch(`/api/admin/bookings/${bookingId}/confirm-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method }),
  });
  // ... handles response, shows toast
}
```
The admin UI already calls the `POST /bookings/:id/confirm-payment` endpoint. No UI changes needed — the receipt email will be sent automatically from the backend.

**BUSINESS constants** — `lib/constants.ts`:
```typescript
export const BUSINESS = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || "RoadSide ATL",
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE || "(404) 555-0199",
  email: "support@roadsideatl.com",
  cashAppTag: process.env.NEXT_PUBLIC_CASHAPP_TAG || "$RoadsideATL",
  zelleInfo: process.env.NEXT_PUBLIC_ZELLE_INFO || "pay@roadsideatl.com",
  serviceArea: "Atlanta Metro Area (ITP & OTP)",
  tagline: "Atlanta's Premium Roadside Assistance",
} as const;
```

### Exact Implementation Specifications

**1. Audit action (`server/api/lib/audit-logger.ts`) — add to AuditAction type:**
```typescript
| "payment.receipt_sent"
```

**2. Receipt email function (`lib/notifications/email.ts`) — append:**
```typescript
export async function sendPaymentReceiptEmail(
  email: string,
  customerName: string,
  bookingId: string,
  serviceName: string,
  amountPaid: number, // cents
  paymentMethod: string,
  paymentDate: string, // ISO string
  providerName?: string
) {
  const resend = getResend();
  if (!resend) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com";
  const receiptUrl = `${appUrl}/api/receipts/${bookingId}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Payment Receipt - RoadSide ATL #${bookingId.slice(0, 8)}`,
    html: `
      <h2>Payment Receipt</h2>
      <p>Hi ${customerName},</p>
      <p>Your payment has been confirmed. Thank you!</p>
      <ul>
        <li><strong>Booking ID:</strong> ${bookingId.slice(0, 8)}</li>
        <li><strong>Service:</strong> ${serviceName}</li>
        <li><strong>Amount Paid:</strong> ${formatPrice(amountPaid)}</li>
        <li><strong>Payment Method:</strong> ${paymentMethod}</li>
        <li><strong>Date:</strong> ${new Date(paymentDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</li>
        ${providerName ? `<li><strong>Provider:</strong> ${providerName}</li>` : ""}
      </ul>
      <p><a href="${receiptUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px;">View Full Receipt</a></p>
      <p>— RoadSide ATL</p>
      <p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${appUrl}/unsubscribe">unsubscribe here</a>.</p>
    `,
  });
}
```

**3. Receipt SMS function (`lib/notifications/sms.ts`) — append:**
```typescript
export async function sendPaymentReceiptSMS(phone: string, bookingId: string, amount: number, paymentMethod: string) {
  await sendSMS(
    phone,
    `RoadSide ATL: Payment confirmed for booking #${bookingId.slice(0, 8)}. ${formatPrice(amount)} via ${paymentMethod}. Thank you! Reply STOP to opt out.`
  );
}
```

**4. Notification coordinator (`lib/notifications/index.ts`) — append:**
```typescript
export async function notifyPaymentConfirmed(
  customer: { name: string; email: string; phone: string },
  bookingId: string,
  serviceName: string,
  amountPaid: number,
  paymentMethod: string,
  paymentDate: string,
  providerName?: string
) {
  await Promise.allSettled([
    sendPaymentReceiptEmail(
      customer.email,
      customer.name,
      bookingId,
      serviceName,
      amountPaid,
      paymentMethod,
      paymentDate,
      providerName
    ),
    sendPaymentReceiptSMS(customer.phone, bookingId, amountPaid, paymentMethod),
  ]);
}
```
Also add the imports at the top:
```typescript
import { sendPaymentReceiptEmail } from "./email";
import { sendPaymentReceiptSMS } from "./sms";
```

**5. Wire into `PATCH /payments/:id/confirm` (admin.ts lines 362-419):**

After the existing `incrementCleanTransaction` block (around line 413), add:

```typescript
// Fetch booking + service + provider for receipt notification
const fullBooking = await db.query.bookings.findFirst({
  where: eq(bookings.id, existingPayment.bookingId),
});
if (fullBooking) {
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

  // Create payout if eligible (currently missing from this endpoint!)
  createPayoutIfEligible(fullBooking.id).catch((err) => {
    console.error("[Payment] Failed to create payout for booking:", fullBooking.id, err);
  });
}
```

**6. Wire into `POST /bookings/:id/confirm-payment` (admin.ts lines 422-483):**

After the existing `createPayoutIfEligible` call (line 480), add:

```typescript
// Fetch service + provider for receipt notification
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

// Send receipt notification (fire-and-forget)
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
```

**Important:** The `notifyPaymentConfirmed` import must be added to the existing notification imports in admin.ts:
```typescript
import { notifyStatusChange, notifyProviderAssigned, notifyReferralLink, notifyPreServiceConfirmation, notifyPaymentConfirmed } from "@/lib/notifications";
```

### Project Structure Notes

**Files to CREATE:**
None — all changes go into existing files.

**Files to MODIFY:**

| File | What to Change |
|---|---|
| `server/api/lib/audit-logger.ts` | Add `"payment.receipt_sent"` to AuditAction type union |
| `lib/notifications/email.ts` | Add `sendPaymentReceiptEmail()` function |
| `lib/notifications/sms.ts` | Add `sendPaymentReceiptSMS()` function |
| `lib/notifications/index.ts` | Add `notifyPaymentConfirmed()` coordinator + imports for new email/sms functions |
| `server/api/routes/admin.ts` | Wire `notifyPaymentConfirmed()` + `payment.receipt_sent` audit + `createPayoutIfEligible` into both confirm-payment endpoints |

**Files NOT to create:**
- NO `lib/notifications/receipt.ts` — receipt email goes in existing `email.ts` (follow established pattern)
- NO `server/api/routes/receipt-email.ts` — receipt sending is wired into existing admin.ts confirm endpoints
- NO `components/admin/payment-receipt-dialog.tsx` — no UI changes needed, receipts send automatically
- NO new schema files or migrations
- NO test files

**Files NOT to modify:**
- NO changes to `lib/receipts/generate-receipt.ts` — the receipt HTML generator is for public receipt pages, not email
- NO changes to `server/api/routes/receipts.ts` — public receipt endpoints already work
- NO changes to `lib/validators.ts` — `confirmPaymentSchema` already covers needed fields
- NO changes to `db/schema/payments.ts` — no schema changes needed
- NO changes to `components/admin/bookings-table.tsx` — admin UI already calls the right endpoint
- NO changes to `server/api/index.ts` — no new route modules
- NO changes to `server/websocket/types.ts` — no new WebSocket events needed for receipts

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a separate receipt email template file | Add `sendPaymentReceiptEmail()` inline in `lib/notifications/email.ts` following existing pattern |
| Generate the full receipt HTML in the email | Use a simplified email with a link to the full receipt at `/api/receipts/:bookingId` |
| Await notification calls in the request handler | Fire-and-forget: `notifyPaymentConfirmed(...).catch(() => {})` |
| Create a new route for sending receipts | Wire into existing confirm-payment endpoints in admin.ts |
| Import from `"zod"` | Import from `"zod/v4"` (though no new validators needed) |
| Use relative imports `../` | Use `@/` path alias |
| Forget to add `createPayoutIfEligible` to PATCH endpoint | The PATCH endpoint is missing payout creation — add it |
| Create default exports for functions | Use named exports: `export async function sendPaymentReceiptEmail()` |
| Send receipt before payment is confirmed | Only send receipt after successful payment status update |
| Skip the unsubscribe link in email | NFR50 CAN-SPAM compliance — MUST include unsubscribe link |
| Use `formatPrice` in SMS (it's for display) | Use `formatPrice` from `@/lib/utils` — it works for both display and SMS |

### Previous Story Intelligence

**From Story 3.1 (Tiered Commission Configuration & Calculation) — DONE:**
- `services` table now has `commissionRate` column — not directly relevant to receipt but good context
- `createPayoutIfEligible()` in `payout-calculator.ts` now uses service-level commission with 3-tier priority chain
- Fire-and-forget pattern for audit/broadcasts (no await, no catch)
- `AuthEnv` type declared locally in route files
- `getRequestInfo(c.req.raw)` for audit logging — `ipAddress` and `userAgent` variables already scoped in both confirm endpoints
- Destructure `.returning()` — always `const [result] = ...`
- Route ordering matters: specific routes BEFORE parameterized `/:id` routes
- Code review found that provider.ts earnings endpoints needed service commission context — similar pattern: when modifying endpoints, check ALL consumers

**From Story 2.3 (Admin Pricing Configuration & Booking Override) — DONE:**
- Admin table component pattern with loading/error states
- Toast notifications: `toast.success()` and `toast.error()` from sonner
- `updatedAt: new Date()` in every update call (NOTE: payments table does NOT have `updatedAt`)

**Key learning from Story 3.1 code review:**
- When adding functionality to endpoints, check BOTH confirm-payment endpoints — there are two and they have different behaviors
- The PATCH endpoint was missing `createPayoutIfEligible` — this is a real gap that this story must fix

### Git Intelligence

**Recent commits:**
```
047d30c Add tiered commission configuration, service-level payout calculation, and admin commission UI
b12c101 Add storm mode activation, time-block pricing config UI, and booking price override
f578855 Add time-block pricing engine, trust tier visibility, referral tracking, and planning artifacts
738335c Add admin trust tier management, observations, referrals, and inspection reports
```

**Patterns observed:**
- Imperative present tense commit messages ("Add", "Fix")
- Features bundled in single commits
- Both confirm-payment endpoints already exist and are well-structured
- The notification pattern (email + SMS + coordinator) is well-established with 9 existing coordinators
- Fire-and-forget is the standard for all notification dispatch in route handlers

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. **TypeScript compilation**: `npx tsc --noEmit` passes with zero errors.
2. **PATCH confirm flow**: Confirm an existing payment via `PATCH /payments/:id/confirm` — receipt email should be sent to customer, `payment.receipt_sent` audit entry logged, `createPayoutIfEligible` called.
3. **POST confirm flow**: Confirm payment via `POST /bookings/:id/confirm-payment` — receipt email sent, audit logged.
4. **Receipt email content**: Email includes booking ID (first 8 chars), service name, amount formatted as currency, payment method, date, provider name (if assigned), and unsubscribe link.
5. **Receipt SMS content**: SMS includes booking ID, amount, and payment method.
6. **Graceful degradation**: If `RESEND_API_KEY` is not set, email silently skips. If Twilio is not configured, SMS silently skips. Neither blocks the payment confirmation response.
7. **Payout creation on PATCH**: After confirming a payment via PATCH, verify that `createPayoutIfEligible` creates a payout if the booking is completed.
8. **Link to full receipt**: Email includes link to `/api/receipts/:bookingId` for the detailed receipt view.
9. **Audit log**: Both `payment.confirm` AND `payment.receipt_sent` entries exist after confirmation.
10. **Fire-and-forget**: Payment confirmation response returns immediately — does NOT wait for email/SMS delivery.

### Dependencies and Scope

**This story depends on:**
- Story 3.1 (Tiered Commission) — DONE. Payout calculator uses service-level commission.
- Existing receipt generator and receipt routes — DONE. Public receipt page serves full receipt HTML.
- Existing notification infrastructure (email.ts, sms.ts, index.ts) — DONE.

**This story blocks:**
- Story 3.3 (Batch Payouts, Refund Processing) — needs consistent payment lifecycle with receipts.

**This story does NOT include:**
- Batch payout processing (Story 3.3)
- Refund handling (Story 3.3)
- Stripe payment receipt (Stripe sends its own receipts via webhook)
- Admin-visible receipt preview in the dashboard
- Receipt download/PDF generation (already exists at `/api/receipts/:bookingId/download`)

**Scope boundary:** Wire receipt email + SMS notifications into both manual payment confirmation endpoints. Fix the missing `createPayoutIfEligible` call in the PATCH endpoint. Add `payment.receipt_sent` audit action. No schema changes, no UI changes, no new route modules.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.2]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: server/api/routes/admin.ts#PATCH /payments/:id/confirm (lines 362-419)]
- [Source: server/api/routes/admin.ts#POST /bookings/:id/confirm-payment (lines 422-483)]
- [Source: lib/notifications/email.ts - 9 existing send functions (pattern to follow)]
- [Source: lib/notifications/sms.ts - 8 existing send functions (pattern to follow)]
- [Source: lib/notifications/index.ts - 9 existing coordinator functions (pattern to follow)]
- [Source: lib/receipts/generate-receipt.ts - Receipt HTML generator (reference, not modified)]
- [Source: server/api/routes/receipts.ts - Public receipt endpoints (reference, not modified)]
- [Source: server/api/lib/audit-logger.ts - AuditAction type (add payment.receipt_sent)]
- [Source: db/schema/payments.ts - Payment schema (no changes needed)]
- [Source: db/schema/bookings.ts - Booking schema (no changes needed)]
- [Source: lib/validators.ts#confirmPaymentSchema - Validation (no changes needed)]
- [Source: components/admin/bookings-table.tsx - Admin UI (no changes needed)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript compilation passed with zero errors after all 7 tasks implemented
- Pre-existing avatar.tsx corruption and stray seed.ts import detected and restored via `git checkout`

### Completion Notes List

- Task 1: Added `"payment.receipt_sent"` to AuditAction type union in audit-logger.ts.
- Task 2: Created `sendPaymentReceiptEmail()` in email.ts — branded HTML with booking ID, service, amount, payment method, date, provider name, receipt link, and NFR50 unsubscribe link. Follows exact pattern of existing 9 send functions.
- Task 3: Created `sendPaymentReceiptSMS()` in sms.ts — short confirmation with booking ID, amount, payment method, and "Reply STOP to opt out."
- Task 4: Created `notifyPaymentConfirmed()` coordinator in notifications/index.ts — uses `Promise.allSettled()` for email + SMS. Added imports for both new functions.
- Task 5: Wired receipt notifications into `PATCH /payments/:id/confirm` — fetches full booking/service/provider, calls `notifyPaymentConfirmed()` fire-and-forget, logs `payment.receipt_sent` audit, AND added missing `createPayoutIfEligible()` call (critical gap fix).
- Task 6: Wired receipt notifications into `POST /bookings/:id/confirm-payment` — fetches service/provider, calls `notifyPaymentConfirmed()` fire-and-forget, logs `payment.receipt_sent` audit.
- Task 7: Verified admin UI already calls correct endpoint. TypeScript compilation clean with zero errors.

### Code Review Fixes (AI Review — 2026-02-16)

- **[M1] Fixed duplicate booking fetch in PATCH endpoint**: Consolidated two separate booking queries into a single full-booking fetch reused for trust tier increment, receipt notification, and payout creation.
- **[M2] Fixed payment method display names**: Added `PAYMENT_METHOD_DISPLAY` lookup map in both `email.ts` and `sms.ts` — "cashapp" now displays as "CashApp", "zelle" as "Zelle", etc. instead of raw enum values.
- **[M3] Added idempotency guard**: PATCH endpoint now checks `wasAlreadyConfirmed` — skips receipt email/SMS and payout creation if payment was already confirmed, preventing duplicate notifications on re-confirmation.

### File List

**Modified:**
- `server/api/lib/audit-logger.ts` — added `payment.receipt_sent` to AuditAction type
- `lib/notifications/email.ts` — added `sendPaymentReceiptEmail()` function, `PAYMENT_METHOD_DISPLAY` map, `formatPaymentMethod()` helper
- `lib/notifications/sms.ts` — added `sendPaymentReceiptSMS()` function, `PAYMENT_METHOD_DISPLAY` map
- `lib/notifications/index.ts` — added `notifyPaymentConfirmed()` coordinator + imports
- `server/api/routes/admin.ts` — wired receipt notifications + payout creation into both confirm-payment endpoints, added idempotency guard, consolidated booking fetch
