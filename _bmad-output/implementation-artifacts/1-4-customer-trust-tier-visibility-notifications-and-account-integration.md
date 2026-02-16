# Story 1.4: Customer Trust Tier Visibility, Notifications & Account Integration

Status: done

## Story

As a customer,
I want to see my trust tier progress and available payment methods, and receive notifications when I unlock card payments,
so that I understand how to earn card payment access and I'm informed when my tier changes.

## Acceptance Criteria

1. **Tier-Aware Payment Step** - Given I am a Tier 1 customer, when I view the payment step during booking, then I see only Cash, CashApp, and Zelle as available payment methods, and I see a progress indicator showing X/N clean transactions toward card access.

2. **Tier 2 Full Payment Access** - Given I am a Tier 2 customer, when I view the payment step during booking, then I see all payment methods including credit card.

3. **Tier Promotion Notification** - Given my clean transaction count reaches the promotion threshold, when my tier is promoted to Tier 2, then I receive an SMS and email notification that card payments are now unlocked, and the SMS includes delivery status tracking (NFR49), and the email includes an unsubscribe link (NFR50), and an audit log entry is created for the tier change.

4. **Account Initialization** - Given a new customer completes their first booking as a guest, when they create an account, then the account is initialized with trustTier = 1, cleanTransactionCount = 0, and a unique referralCode (FR48).

5. **Authentication Verification** - Given a returning customer, when they authenticate, then Google OAuth and email/password credentials both work correctly (FR49), and session expires after 24 hours of inactivity (NFR15).

6. **Payment Method Filtering** - Given a customer views their payment methods page, when they manage payment methods, then available methods are filtered by their current Trust Tier (FR51).

7. **Dual Role Support** - Given a user holds both customer and provider roles, when they switch between roles, then the UI switches context based on their active role on a single account (FR55).

## Tasks / Subtasks

- [x] Task 1: Tier promotion notification functions (AC: #3)
  - [x] 1.1 Add `sendTierPromotionSMS(phone, newTier)` to `lib/notifications/sms.ts` — message says card payments are now unlocked
  - [x] 1.2 Add `sendTierPromotionEmail(email, name, newTier)` to `lib/notifications/email.ts` — email includes unsubscribe link (NFR50), congratulations copy, and explanation of new payment options
  - [x] 1.3 Add `notifyTierPromotion(customer, newTier)` orchestrator to `lib/notifications/index.ts` using `Promise.allSettled()`
  - [x] 1.4 Integrate `notifyTierPromotion` call in `server/api/lib/trust-tier.ts` — fire-and-forget after successful promotion in `incrementCleanTransaction()` (line 64-76, after audit log). Must look up user's phone/email/name to pass to notification.

- [x] Task 2: Registration referral code generation (AC: #4)
  - [x] 2.1 Modify `server/api/routes/auth.ts` registration handler — import `generateReferralCode` from `../lib/referral-credits` and include `referralCode: generateReferralCode()` in the `db.insert(users).values()` call (line 46-51)
  - [x] 2.2 Verify `trustTier` (default 1) and `cleanTransactionCount` (default 0) are applied via schema defaults — no code change needed, just verify

- [x] Task 3: Customer trust tier API endpoint (AC: #1, #2, #6)
  - [x] 3.1 Add `GET /me/trust-tier` endpoint to an appropriate authenticated route — returns `{ trustTier, cleanTransactionCount, promotionThreshold, allowedPaymentMethods }` for the current user
  - [x] 3.2 The endpoint reads promotion threshold via `getPromotionThreshold()` from `server/api/lib/trust-tier.ts` and allowed methods via `getAllowedPaymentMethods()`

- [x] Task 4: Payment method selector component (AC: #1, #2, #6)
  - [x] 4.1 Create `components/booking/payment-method-selector.tsx` — client component that fetches `/api/users/me/trust-tier` to get allowed methods
  - [x] 4.2 Display allowed payment methods as selectable options (Cash, CashApp, Zelle for Tier 1; plus Stripe/Card for Tier 2)
  - [x] 4.3 For Tier 1 users, show a progress indicator: "X/N clean transactions until card payments are unlocked"
  - [x] 4.4 For Tier 2 users, show a badge: "Card Payments Unlocked"

- [x] Task 5: Integrate payment method selector into booking form (AC: #1, #2)
  - [x] 5.1 Modify `components/booking/booking-form.tsx` — import and render `PaymentMethodSelector` in the review/booking step
  - [x] 5.2 Pass selected payment method to the booking POST request body
  - [x] 5.3 Only show payment method selector when user is authenticated — guest bookings default to cash/CashApp/Zelle

- [x] Task 6: Customer dashboard trust tier card (AC: #1)
  - [x] 6.1 Create `components/dashboard/trust-tier-card.tsx` — client component showing current tier, progress bar (X/N clean transactions), allowed payment methods list, and explanation text
  - [x] 6.2 Modify `app/(dashboard)/dashboard/page.tsx` — replace the redirect with a proper dashboard page that includes the trust tier card and a quick summary of recent bookings/referral link

- [x] Task 7: Verification tasks (AC: #4, #5, #7)
  - [x] 7.1 Verify Google OAuth and email/password authentication works — check `lib/auth.ts` and `lib/auth.config.ts`
  - [x] 7.2 Verify session JWT includes `id` and `role` — check JWT callback in `lib/auth.ts`
  - [x] 7.3 Verify dual-role support — current architecture uses single `role` field on users. FR55 is limited to the existing role model (user has ONE role). Verify the UI correctly renders based on `user.role` in session.
  - [x] 7.4 Verify session expiration is configured (NFR15 — 24 hours inactivity)

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**Backend trust tier system is 100% complete.** Stories 1.1, 1.2, and 1.3 have built the entire backend: schema columns (`trustTier`, `cleanTransactionCount`, `referralCode` on users), promotion engine (`server/api/lib/trust-tier.ts`), payment enforcement middleware (`server/api/middleware/trust-tier.ts`), admin API (`server/api/routes/trust-tier.ts`), and admin UI (`components/admin/trust-tier-table.tsx`).

**This story is primarily CUSTOMER-FACING.** The main new work is: (1) tier promotion notifications, (2) payment method selector for booking flow, (3) customer dashboard with tier progress, (4) referral code generation on registration.

**Integer math only.** No floating point anywhere. Money in cents, multipliers in basis points.

**No test framework installed.** Do NOT create test files.

### Existing Code You MUST Understand

**Trust Tier Data Model** — `db/schema/users.ts` (EXISTS):
```typescript
trustTier: integer("trustTier").default(1).notNull(),
cleanTransactionCount: integer("cleanTransactionCount").default(0).notNull(),
referralCode: text("referralCode").unique(),
```
Trust Tier defaults to 1 on insert. No explicit value needed during registration — just needs `referralCode` generated.

**Trust Tier Promotion Engine** — `server/api/lib/trust-tier.ts` (EXISTS):
```typescript
export const TIER_1_ALLOWED_METHODS = ["cash", "cashapp", "zelle"] as const;
export const TIER_2_ALLOWED_METHODS = ["cash", "cashapp", "zelle", "stripe"] as const;

export function getAllowedPaymentMethods(trustTier: number): readonly string[];
export async function getPromotionThreshold(): Promise<number>;
export async function incrementCleanTransaction(userId: string): Promise<{
  promoted: boolean;
  newTier: number;
  newCount: number;
}>;
```

**CRITICAL:** `incrementCleanTransaction()` returns `{ promoted: true }` when a user is promoted. This is the integration point for notifications. After the audit log (line 65-76), add a fire-and-forget `notifyTierPromotion()` call. Must look up user's phone/email/name first since the function only has `userId`.

**Registration Handler** — `server/api/routes/auth.ts` (MODIFY):
```typescript
// Line 46-51 — current registration insert:
const [newUser] = await db.insert(users).values({
  name,
  email,
  password: hashedPassword,
  // emailVerified is null - user must verify
}).returning({ id: users.id });
```
Add `referralCode: generateReferralCode()` to the values object. Import `generateReferralCode` from `../lib/referral-credits`.

**Referral Code Generator** — `server/api/lib/referral-credits.ts` (EXISTS):
```typescript
export function generateReferralCode(): string {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}
```

**Booking Form** — `components/booking/booking-form.tsx` (MODIFY):
Multi-step form with 4 steps: Service → Location & Vehicle → Contact & Schedule → Review & Book. Currently does NOT have a payment method selection step. The payment method selector should be integrated into the "Review & Book" step (step 4) or added as a new step before review.

**Customer Dashboard** — `app/(dashboard)/dashboard/page.tsx` (MODIFY):
Currently just `redirect("/my-bookings")`. Replace with a proper dashboard page that shows trust tier status card and links to bookings/referrals.

**Auth System** — `lib/auth.ts` (VERIFY ONLY):
NextAuth v5 with JWT strategy. Session includes `user.id` and `user.role`. Google OAuth and Credentials providers configured. JWT callback queries `users` table to populate role.

**Notification Pattern** — `lib/notifications/index.ts` (MODIFY):
All notification orchestrators use `Promise.allSettled()` for multi-channel delivery. Fire-and-forget via `.catch(() => {})` from callers.

**Allowed Payment Methods API** — The trust tier route at `GET /api/admin/trust-tier` is admin-only. For customer-facing tier info, a new endpoint is needed (e.g., `GET /api/users/me/trust-tier`). Alternatively, add a handler to an existing authenticated route that returns tier info for the current user.

### Exact Implementation Specifications

**1. Tier Promotion SMS — `lib/notifications/sms.ts`:**

```typescript
export async function sendTierPromotionSMS(phone: string) {
  await sendSMS(
    phone,
    `RoadSide ATL: Congratulations! You've unlocked card payments. You can now pay with credit/debit cards on your next booking. Reply STOP to opt out.`
  );
}
```

**2. Tier Promotion Email — `lib/notifications/email.ts`:**

```typescript
export async function sendTierPromotionEmail(email: string, name: string) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Card Payments Unlocked! - RoadSide ATL",
    html: `
      <h2>Congratulations, ${name}!</h2>
      <p>You've earned Trusted Customer status on RoadSide ATL.</p>
      <p>You can now pay with <strong>credit and debit cards</strong> in addition to Cash, CashApp, and Zelle.</p>
      <p>Thank you for being a loyal customer!</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/book">Book Your Next Service</a></p>
      <p>— RoadSide ATL</p>
      <p style="font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com"}/unsubscribe">unsubscribe here</a>.</p>
    `,
  });
}
```

**3. Tier Promotion Orchestrator — `lib/notifications/index.ts`:**

```typescript
export async function notifyTierPromotion(
  customer: { name: string; email: string; phone: string },
) {
  await Promise.allSettled([
    sendTierPromotionEmail(customer.email, customer.name),
    sendTierPromotionSMS(customer.phone),
  ]);
}
```

**4. Integration in trust-tier.ts — After promotion in `incrementCleanTransaction()`:**

After line 76 (after the audit log), add:
```typescript
// Look up user for notification (fire-and-forget)
(async () => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { name: true, email: true, phone: true },
  });
  if (user?.email && user?.phone) {
    const { notifyTierPromotion } = await import("@/lib/notifications");
    notifyTierPromotion({
      name: user.name || "Customer",
      email: user.email,
      phone: user.phone,
    }).catch(() => {});
  }
})().catch(() => {});
```

**Note:** Use dynamic import to avoid circular dependency (trust-tier.ts is server lib, notifications imports from email/sms). Alternative: import at top of file if no circular issue.

**5. Customer Trust Tier Endpoint:**

Add to an existing user-facing route (e.g., create a new route or add to bookings route). Simplest approach: add `GET /me/trust-tier` to a new `server/api/routes/users.ts` or to the existing route structure.

```typescript
// GET /me/trust-tier
app.get("/me/trust-tier", async (c) => {
  const user = c.get("user");
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { trustTier: true, cleanTransactionCount: true },
  });
  if (!dbUser) return c.json({ error: "User not found" }, 404);

  const threshold = await getPromotionThreshold();
  const allowedMethods = getAllowedPaymentMethods(dbUser.trustTier);

  return c.json({
    trustTier: dbUser.trustTier,
    cleanTransactionCount: dbUser.cleanTransactionCount,
    promotionThreshold: threshold,
    allowedPaymentMethods: allowedMethods,
  });
});
```

Register in `server/api/index.ts`.

**6. Payment Method Selector Component:**

```typescript
// components/booking/payment-method-selector.tsx
"use client";
// Fetches /api/users/me/trust-tier
// Renders payment method radio buttons filtered by allowedPaymentMethods
// Shows progress indicator for Tier 1 users
// Shows "Card Payments Unlocked" badge for Tier 2
```

**7. Customer Dashboard:**

Replace the redirect in `app/(dashboard)/dashboard/page.tsx` with a server component page that renders:
- `<TrustTierCard />` — shows tier badge, progress bar, allowed methods
- Quick links to booking history, referrals
- The page itself can be a Server Component; the trust tier card is a Client Component

### Project Structure Notes

**Files to CREATE:**

| File | Purpose |
|---|---|
| `components/booking/payment-method-selector.tsx` | Tier-aware payment method selection for booking flow |
| `components/dashboard/trust-tier-card.tsx` | Customer trust tier progress display card |
| `server/api/routes/users.ts` | User-facing API (trust tier info endpoint) |

**Files to MODIFY (append/extend):**

| File | What to Add |
|---|---|
| `lib/notifications/sms.ts` | `sendTierPromotionSMS` function |
| `lib/notifications/email.ts` | `sendTierPromotionEmail` function |
| `lib/notifications/index.ts` | `notifyTierPromotion` orchestrator + imports |
| `server/api/lib/trust-tier.ts` | Fire-and-forget notification call after promotion |
| `server/api/routes/auth.ts` | `referralCode: generateReferralCode()` in registration insert |
| `server/api/index.ts` | Register users route |
| `components/booking/booking-form.tsx` | Integrate payment method selector |
| `app/(dashboard)/dashboard/page.tsx` | Replace redirect with dashboard page |

**Files to VERIFY (already exist, confirm correctness):**

| File | What to Verify |
|---|---|
| `db/schema/users.ts` | trustTier, cleanTransactionCount, referralCode columns |
| `server/api/lib/trust-tier.ts` | getAllowedPaymentMethods, getPromotionThreshold, incrementCleanTransaction |
| `server/api/middleware/trust-tier.ts` | validatePaymentMethod middleware |
| `lib/auth.ts` | JWT callback with role, session structure |
| `lib/auth.config.ts` | Google + Credentials providers |

**Files NOT to create:**
- NO `components/trust-tier/` directory — use `components/dashboard/` and `components/booking/`
- NO `lib/trust-tier/` directory — domain logic stays in `server/api/lib/`
- NO `types/trust-tier.d.ts` — co-locate types
- NO test files

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a separate trust tiers API with admin middleware | Create a user-facing endpoint with `requireAuth` |
| Show all payment methods to Tier 1 users with disabled cards | Only show allowed methods, with progress indicator |
| Calculate tier client-side | Always fetch from server API |
| Skip notification on auto-promotion | Fire-and-forget `notifyTierPromotion()` after every promotion |
| Add `trustTier` to JWT/session | Query from DB when needed — tier can change between sessions |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |
| Forget `updatedAt: new Date()` in update calls | Always include it |
| Create a payment methods management page | Out of scope — just filter in booking flow |
| Import trust-tier.ts in client components | Only server-side; expose via API endpoint |

### Previous Story Intelligence

**From Story 1.1 (Trust Tier Data Model):**
- `db:migrate` was not run during 1.1 (requires live DB). Migration `0006_handy_mister_fear.sql` adds trustTier + cleanTransactionCount columns. Verify applied.
- Promotion logic uses atomic SQL increment (`sql\`${users.cleanTransactionCount} + 1\``) to prevent race conditions — maintain this pattern.
- Audit logging is fire-and-forget (`logAudit()` without await) per codebase convention.

**From Story 1.2 (Payment Method Enforcement):**
- `validatePaymentMethod` middleware blocks Tier 1 from Stripe. Applied to payment routes.
- Booking ownership check pattern: middleware + handler both verify.
- `AuthEnv` type param required: `new Hono<AuthEnv>()`.

**From Story 1.3 (Admin Trust Tier Configuration):**
- `getPromotionThreshold()` reads from `platformSettings` table with fallback to constant (3).
- Admin trust tier page exists with search, pagination, promote/demote actions.
- Code review found and fixed: atomicity guards on PATCH endpoints, unbounded limit clamping, no-op guard on config update.
- `checkAndPromote()` also uses DB threshold.

**Key Pattern from Previous Stories:**
- The trust-tier.ts `incrementCleanTransaction()` returns `{ promoted: true }` — this is the hook for notification. Currently only logs audit, does NOT notify customer.

### Scope Clarification

**FR55 (Dual Role Support):** The current architecture uses a single `role` field on users (`"customer"` | `"admin"` | `"provider"`). A user cannot hold both customer and provider roles simultaneously in the current data model. This story verifies the existing role-based UI switching works correctly. If full dual-role is needed, it requires a schema change (roles table or array field) which is out of scope for this story.

**FR51 (Payment Methods Management):** This story integrates tier filtering into the booking flow payment step. A dedicated payment methods management page (Stripe saved cards, etc.) is out of scope — that requires Stripe Customer Portal integration which is separate work.

**Customer Dashboard:** The current dashboard redirects to `/my-bookings`. This story adds a minimal dashboard page with the trust tier card. It should NOT be over-engineered — just trust tier status + quick links.

### Dependencies and Scope

**This story depends on:** Stories 1.1, 1.2, 1.3 (all completed/in-review)

**This story blocks:** Nothing directly

**This story does NOT include:**
- Admin trust tier management (Story 1.3 — done)
- Payment enforcement middleware (Story 1.2 — done)
- Trust tier schema (Story 1.1 — done)
- Stripe saved cards management page
- Full dual-role infrastructure (schema change for multiple roles per user)
- Booking flow pricing display (Epic 2/4)

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. Register a new user → verify `referralCode` is generated and stored
2. Log in as Tier 1 customer → verify only Cash/CashApp/Zelle payment methods shown
3. Log in as Tier 2 customer → verify all payment methods including card shown
4. Trigger auto-promotion (admin confirms 3 payments for a user) → verify SMS and email sent to customer
5. View customer dashboard → verify trust tier card shows correct tier, progress, allowed methods
6. View booking form → verify payment method selector shows filtered options
7. Verify Google OAuth login works
8. Verify email/password login works
9. Verify non-authenticated users see default payment options (Cash/CashApp/Zelle)
10. Verify session includes `id` and `role`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1, Story 1.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns - Trust Tier State Machine]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns - Notification Triggers]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture - Trust Tier Admin]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Structure Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns for New Features]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: db/schema/users.ts - trustTier, cleanTransactionCount, referralCode columns]
- [Source: server/api/lib/trust-tier.ts - getAllowedPaymentMethods, getPromotionThreshold, incrementCleanTransaction]
- [Source: server/api/middleware/trust-tier.ts - validatePaymentMethod middleware]
- [Source: server/api/routes/auth.ts - Registration handler (line 46-51)]
- [Source: server/api/lib/referral-credits.ts - generateReferralCode()]
- [Source: lib/notifications/index.ts - Notification orchestrator pattern]
- [Source: lib/notifications/email.ts - Email template pattern with unsubscribe link]
- [Source: lib/notifications/sms.ts - SMS template pattern]
- [Source: components/booking/booking-form.tsx - Multi-step booking form]
- [Source: app/(dashboard)/dashboard/page.tsx - Current redirect-only dashboard]
- [Source: lib/auth.ts - NextAuth v5 JWT callback with role]
- [Source: _bmad-output/implementation-artifacts/1-1-trust-tier-data-model-and-promotion-engine.md]
- [Source: _bmad-output/implementation-artifacts/1-2-payment-method-enforcement-middleware.md]
- [Source: _bmad-output/implementation-artifacts/1-3-admin-trust-tier-configuration-and-management.md]

## Senior Developer Review

### Review Date
2026-02-14

### Review Model
Claude Opus 4.6

### Findings

| # | Severity | File(s) | Issue | Resolution |
|---|----------|---------|-------|------------|
| 1 | HIGH | `lib/validators.ts`, `server/api/routes/bookings.ts`, `db/schema/bookings.ts` | `paymentMethod` accepted by booking form but silently dropped — no validator field, no schema column, no persistence in insert | Added `paymentMethod` enum to `createBookingSchema`, added `preferredPaymentMethod` text column to bookings schema, added persistence in booking route insert |
| 2 | MEDIUM | `server/api/routes/trust-tier.ts` | Admin manual promote via PATCH `/:userId` does not fire `notifyTierPromotion()` — customer only gets notified on auto-promotion, not admin override | Added fire-and-forget `notifyTierPromotion()` call after admin promote to Tier 2+ |
| 3 | MEDIUM | `components/dashboard/trust-tier-card.tsx`, `components/booking/payment-method-selector.tsx` | Division by zero possible if `promotionThreshold` is 0 in progress bar calculation | Added `Math.max(1, ...)` guard in both components |
| 4 | MEDIUM | `components/booking/payment-method-selector.tsx`, `components/dashboard/trust-tier-card.tsx` | Hard-coded gray/blue/green Tailwind colors break dark mode — project uses shadcn theme tokens | Replaced all hard-coded colors with theme tokens (`text-foreground`, `bg-muted`, `border-border`, `bg-primary`, `bg-primary/10`, `bg-primary/20`, `text-primary`) |

### Fixes Applied
All 4 findings fixed and verified via clean build.

### Additional Changes from Review
- Added DB migration `0010_sharp_senator_kelly.sql` for `preferredPaymentMethod` column on bookings table
- Added `phone` to admin promote query columns to support notification lookup

### Verdict
PASS — All HIGH and MEDIUM findings resolved. Build passes clean.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Build passed cleanly with zero TypeScript errors

### Completion Notes List
- Task 1: Added `sendTierPromotionSMS` (SMS with delivery status callback), `sendTierPromotionEmail` (email with unsubscribe link), `notifyTierPromotion` orchestrator (Promise.allSettled), and fire-and-forget integration in `incrementCleanTransaction()` using dynamic import IIFE to avoid circular dependency
- Task 2: Added `referralCode: generateReferralCode()` to registration insert in auth.ts. trustTier (default 1) and cleanTransactionCount (default 0) confirmed via schema defaults
- Task 3: Created `server/api/routes/users.ts` with `GET /me/trust-tier` endpoint returning trustTier, cleanTransactionCount, promotionThreshold, allowedPaymentMethods. Registered at `/api/users`
- Task 4: Created `PaymentMethodSelector` client component — fetches tier info from API, renders selectable payment method buttons filtered by tier, shows progress bar for Tier 1 users and "Card Payments Unlocked" badge for Tier 2
- Task 5: Integrated `PaymentMethodSelector` into booking form step 4, added `paymentMethod` state, passes selection to POST body. Guest users default to Cash/CashApp/Zelle
- Task 6: Created `TrustTierCard` client component with tier badge, progress bar, allowed methods display. Replaced dashboard redirect with proper page showing trust tier card + quick links
- Task 7: Verified Google OAuth + Credentials auth, JWT includes id + role, dual-role is single-role per user (per scope). Added `maxAge: 24 * 60 * 60` (24h) to session config for NFR15

### Change Log
- 2026-02-14: Implemented all 7 tasks for Story 1.4 — tier promotion notifications, registration referral code, customer trust tier API, payment method selector, booking form integration, customer dashboard, auth verification + session maxAge fix

### File List
- `lib/notifications/sms.ts` — added `sendTierPromotionSMS`
- `lib/notifications/email.ts` — added `sendTierPromotionEmail`
- `lib/notifications/index.ts` — added `notifyTierPromotion` orchestrator + imports
- `server/api/lib/trust-tier.ts` — added fire-and-forget notification in `incrementCleanTransaction()` after promotion
- `server/api/routes/auth.ts` — added `referralCode: generateReferralCode()` import and insert
- `server/api/routes/users.ts` — NEW: user-facing API with `GET /me/trust-tier`
- `server/api/index.ts` — registered users route
- `components/booking/payment-method-selector.tsx` — NEW: tier-aware payment method selection (review: theme token colors)
- `components/booking/booking-form.tsx` — integrated PaymentMethodSelector + paymentMethod state
- `components/dashboard/trust-tier-card.tsx` — NEW: customer trust tier progress card (review: theme token colors, div-by-zero guard)
- `app/(dashboard)/dashboard/page.tsx` — replaced redirect with proper dashboard page
- `lib/auth.ts` — added session maxAge 24h for NFR15
- `db/schema/bookings.ts` — (review fix) added `preferredPaymentMethod` column
- `lib/validators.ts` — (review fix) added `paymentMethod` enum to `createBookingSchema`
- `server/api/routes/bookings.ts` — (review fix) persist `preferredPaymentMethod` in booking insert
- `server/api/routes/trust-tier.ts` — (review fix) added admin promote notification + `phone` to query columns
- `db/migrations/0010_sharp_senator_kelly.sql` — (review fix) migration for `preferredPaymentMethod`
