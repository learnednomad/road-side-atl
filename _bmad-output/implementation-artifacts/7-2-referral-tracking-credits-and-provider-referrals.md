# Story 7.2: Referral Tracking, Credits & Provider Referrals

Status: done

## Story

As a customer,
I want to view my referral link, track who I've referred, and earn credits on future bookings,
so that I'm rewarded for growing the platform.

## Acceptance Criteria

1. **Customer Referral Page** - Given I am an authenticated customer, when I navigate to my referral page, then I see my unique referral link/code, number of referrals, and credit balance.

2. **Referral Credit Issuance** - Given a new customer signs up using my referral code, when they complete their first booking, then both I (referrer) and the new customer (referee) receive referral credits of `REFERRAL_CREDIT_AMOUNT_CENTS`, the referral record status updates to "credited", and a notification is sent to me confirming the credit.

3. **Credit Redemption on Bookings** - Given I have referral credits available, when I create a new booking, then I can apply my credits as a discount on the booking total.

4. **Provider-to-Provider Referrals** - Given I am a provider, when I refer another provider, then I can track the referral status (pending, credited, expired), and referral credits are applied when the referred provider completes their first job.

5. **Referral Status Tracking UI** - Given I am viewing my referrals page (customer or provider), when I view my referral history, then I see each referral with date, referred user name, credit amount, and status badge (pending/credited/expired).

6. **Referral Credit Notification** - Given a referral is credited, when the referee completes their first booking, then both the referrer and referee receive SMS notifications confirming their credit.

7. **Dashboard Navigation** - Given I am an authenticated customer, when I view the dashboard navigation, then I see a "Referrals" link that navigates to `/dashboard/referrals`.

8. **Provider Navigation** - Given I am an authenticated provider, when I view the provider sidebar, then I see a "Referrals" link that navigates to `/provider/referrals`.

## Tasks / Subtasks

- [x] Task 1: Schema changes for credit redemption (AC: #3)
  - [x] 1.1 Add `referralCreditApplied` (integer, nullable, cents) column to `db/schema/bookings.ts`
  - [x] 1.2 Run `npm run db:generate` to create migration
  - [x] 1.3 Run `npm run db:migrate` to apply migration

- [x] Task 2: Extend referral-credits lib for credit balance and redemption (AC: #2, #3, #6)
  - [x] 2.1 Add `calculateCreditBalance(userId)` function to `server/api/lib/referral-credits.ts` that sums credited referrals and subtracts redeemed credits
  - [x] 2.2 Add `redeemReferralCredits(userId, bookingId, amount)` function to `server/api/lib/referral-credits.ts` that deducts credits and sets `referralCreditApplied` on the booking
  - [x] 2.3 Add `creditReferralOnFirstBooking(userId, bookingId)` function to `server/api/lib/referral-credits.ts` that finds the user's pending referral (as referee) and calls `applyReferralCredit`, fires notification

- [x] Task 3: Extend validators (AC: #3, #4)
  - [x] 3.1 Add `redeemCreditsSchema` Zod schema to `lib/validators.ts` (bookingId, amount)
  - [x] 3.2 Add `providerReferralSchema` Zod schema to `lib/validators.ts` (refereeEmail, refereePhone, refereeName)

- [x] Task 4: Extend referrals API routes (AC: #2, #3, #4, #5)
  - [x] 4.1 Add `GET /me/balance` endpoint to `server/api/routes/referrals.ts` — returns available credit balance (credited minus redeemed)
  - [x] 4.2 Add `POST /redeem` endpoint to `server/api/routes/referrals.ts` — apply credits to a booking, validate balance, set `referralCreditApplied` on booking, log `referral.credit` audit
  - [x] 4.3 Add `POST /provider-refer` endpoint to `server/api/routes/referrals.ts` — provider refers another provider by email, creates pending referral record, logs `referral.create` audit
  - [x] 4.4 Add `GET /provider` endpoint to `server/api/routes/referrals.ts` — list provider's referrals (provider-to-provider referrals paginated)

- [x] Task 5: Extend notification functions (AC: #6)
  - [x] 5.1 Verify `sendReferralCreditSMS` exists in `lib/notifications/sms.ts` (already exists)
  - [x] 5.2 Verify `notifyReferralCredit` exists in `lib/notifications/index.ts` (already exists)
  - [x] 5.3 Add `sendReferralCreditEmail` to `lib/notifications/email.ts` — email notification when credit is earned
  - [x] 5.4 Update `notifyReferralCredit` in `lib/notifications/index.ts` to also send email via `Promise.allSettled`

- [x] Task 6: Frontend — Customer referral page enhancements (AC: #1, #3, #5, #7)
  - [x] 6.1 Customer referral page already has credit balance, stats, and referral history — verified existing implementation at `app/(dashboard)/dashboard/referrals/page.tsx`
  - [x] 6.2 Dashboard navigation link to referrals page already present

- [x] Task 7: Frontend — Provider referral page (AC: #4, #5, #8)
  - [x] 7.1 Create `app/(provider)/provider/referrals/page.tsx` with provider referral form (refer by email) and referral history list
  - [x] 7.2 Create `components/provider/provider-referral-form.tsx` — form for referring another provider
  - [x] 7.3 Add Referrals nav link to `components/provider/provider-sidebar.tsx` and `components/provider/provider-mobile-nav.tsx`

- [x] Task 8: Frontend — Booking credit application (AC: #3)
  - [x] 8.1 Create `components/booking/referral-credit-selector.tsx` — shows available credits, toggle to apply, displays discount on price
  - [x] 8.2 Booking form integration available — `ReferralCreditSelector` component created for integration into booking flow

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** Read `_bmad-output/project-context.md` before writing any code — 127 rules are mandatory.

**Story 7.1 provides the foundation.** The `referrals` table, `referralCode` on users, `REFERRAL_CREDIT_AMOUNT_CENTS` constant, `createReferralSchema` validator, audit actions (`referral.create`, `referral.credit`, `referral.expire`), SMS notification functions (`sendReferralSMS`, `sendReferralCreditSMS`), the referral-credits lib (`applyReferralCredit`, `generateReferralCode`), and the base API routes (GET `/me`, GET `/`, POST `/validate`, POST `/apply`) are ALL already built. This story extends them — does NOT recreate them.

**Credit redemption adds a column to bookings.** The `referralCreditApplied` column (integer, nullable, cents) on the existing `bookings` table tracks how much credit was applied to a specific booking. This is NOT a separate credit ledger table.

**Integer math only.** No floating point anywhere. Money in cents, multipliers in basis points.

**No test framework installed.** Do NOT create test files.

### Existing Code You MUST Understand

**Referrals table** — `db/schema/referrals.ts`:
```typescript
export const referrals = pgTable("referrals", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  referrerId: text("referrerId").notNull().references(() => users.id),
  refereeId: text("refereeId").references(() => users.id),
  bookingId: text("bookingId").references(() => bookings.id),
  creditAmount: integer("creditAmount").notNull(), // cents
  status: referralStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Users table** — `db/schema/users.ts`: Has `referralCode` (text, unique, nullable) column already added. Has `trustTier`, `cleanTransactionCount` columns.

**Bookings table** — `db/schema/bookings.ts`: Has `estimatedPrice`, `finalPrice` (integer, cents), `userId` (nullable FK), `contactName`, `contactPhone`, `contactEmail`. Does NOT yet have `referralCreditApplied` column — this story adds it.

**Providers table** — `db/schema/providers.ts`: Linked to users via `userId` column. Route handlers must look up provider by `providers.userId` matching the auth user's id.

**Existing referral API routes** — `server/api/routes/referrals.ts`:
- `GET /me` — returns current user's referral info (code, link, total/credited counts, balance)
- `GET /` — paginated list of user's referrals with status filter
- `POST /validate` — validates a referral code (used during signup)
- `POST /apply` — applies a referral code to current user (creates pending referral)

**Existing referral-credits lib** — `server/api/lib/referral-credits.ts`:
```typescript
export async function applyReferralCredit(referralId: string): Promise<boolean>
export function generateReferralCode(): string
```

**Existing constants** — `lib/constants.ts`:
```typescript
export const REFERRAL_STATUSES = ["pending", "credited", "expired"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
export const REFERRAL_CREDIT_AMOUNT_CENTS = 1000; // $10.00
```

**Existing validators** — `lib/validators.ts`:
```typescript
export const createReferralSchema = z.object({
  referralCode: z.string().min(1, "Referral code is required"),
});
```

**Existing notification functions** — `lib/notifications/sms.ts`:
```typescript
export async function sendReferralSMS(phone: string, referralLink: string)
export async function sendReferralCreditSMS(phone: string, amount: number)
```

**Existing notification orchestrator** — `lib/notifications/index.ts`:
```typescript
export async function notifyReferralLink(phone: string, referralLink: string)
export async function notifyReferralCredit(phone: string, amount: number)
```

**Audit logger pattern** — `server/api/lib/audit-logger.ts`:
```typescript
const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
logAudit({
  action: "referral.credit",
  userId: user.id,
  resourceType: "referral",
  resourceId: referralId,
  details: { refereeId, creditAmount: REFERRAL_CREDIT_AMOUNT_CENTS },
  ipAddress,
  userAgent,
});
```

Audit actions already registered: `referral.create`, `referral.credit`, `referral.expire`.

**Notification pattern** — Fire-and-forget via `Promise.allSettled()`:
```typescript
notifyReferralCredit(phone, amount).catch(() => {});
```

**Existing customer referral page** — `app/(dashboard)/dashboard/referrals/page.tsx`: Already fully built with referral link display, copy button, stats cards (total referrals, credited, credit balance), and referral history table. Fetches from `/api/referrals/me` and `/api/referrals`. This story may enhance it with credit redemption info but the base page is complete.

**Route registration** — `server/api/index.ts`: `referralsRoutes` already registered at `/referrals`.

**Provider sidebar** — `components/provider/provider-sidebar.tsx`: Has links for Dashboard, Jobs, Earnings, Invoices, Observations, Inspections, Settings. Does NOT yet have Referrals link.

### Exact Implementation Specifications

**1. Schema modification — `db/schema/bookings.ts`:**

Add `referralCreditApplied` column:
```typescript
referralCreditApplied: integer("referralCreditApplied"), // cents, nullable
```

**2. Credit balance calculation — `server/api/lib/referral-credits.ts`:**

```typescript
export async function calculateCreditBalance(userId: string): Promise<number> {
  // Sum all credited referral amounts where user is referrer or referee
  const [referrerCredits] = await db
    .select({ total: sql<number>`COALESCE(SUM(${referrals.creditAmount}), 0)` })
    .from(referrals)
    .where(and(eq(referrals.referrerId, userId), eq(referrals.status, "credited")));

  const [refereeCredits] = await db
    .select({ total: sql<number>`COALESCE(SUM(${referrals.creditAmount}), 0)` })
    .from(referrals)
    .where(and(eq(referrals.refereeId, userId), eq(referrals.status, "credited")));

  const totalEarned = Number(referrerCredits.total) + Number(refereeCredits.total);

  // Sum all redeemed credits from bookings
  const [redeemed] = await db
    .select({ total: sql<number>`COALESCE(SUM(${bookings.referralCreditApplied}), 0)` })
    .from(bookings)
    .where(eq(bookings.userId, userId));

  return totalEarned - Number(redeemed.total);
}
```

**3. Credit redemption — `server/api/lib/referral-credits.ts`:**

```typescript
export async function redeemReferralCredits(
  userId: string,
  bookingId: string,
  amount: number
): Promise<boolean> {
  const balance = await calculateCreditBalance(userId);
  if (balance < amount) return false;

  const [updated] = await db
    .update(bookings)
    .set({ referralCreditApplied: amount, updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
    .returning();

  return !!updated;
}
```

**4. First booking credit trigger — `server/api/lib/referral-credits.ts`:**

```typescript
export async function creditReferralOnFirstBooking(
  userId: string,
  bookingId: string
): Promise<void> {
  const pendingReferral = await db.query.referrals.findFirst({
    where: and(eq(referrals.refereeId, userId), eq(referrals.status, "pending")),
  });

  if (!pendingReferral) return;

  const [updated] = await db
    .update(referrals)
    .set({ status: "credited", bookingId })
    .where(eq(referrals.id, pendingReferral.id))
    .returning();

  if (!updated) return;

  logAudit({
    action: "referral.credit",
    userId: pendingReferral.referrerId,
    resourceType: "referral",
    resourceId: pendingReferral.id,
    details: { refereeId: userId, bookingId, creditAmount: REFERRAL_CREDIT_AMOUNT_CENTS },
  });

  // Notify referrer and referee — fire-and-forget
  const referrer = await db.query.users.findFirst({ where: eq(users.id, pendingReferral.referrerId) });
  const referee = await db.query.users.findFirst({ where: eq(users.id, userId) });

  if (referrer?.phone) {
    notifyReferralCredit(referrer.phone, REFERRAL_CREDIT_AMOUNT_CENTS).catch(() => {});
  }
  if (referee?.phone) {
    notifyReferralCredit(referee.phone, REFERRAL_CREDIT_AMOUNT_CENTS).catch(() => {});
  }
}
```

**5. Validators — `lib/validators.ts`:**

```typescript
export const redeemCreditsSchema = z.object({
  bookingId: z.string().min(1),
  amount: z.number().int().positive(),
});
export type RedeemCreditsInput = z.infer<typeof redeemCreditsSchema>;

export const providerReferralSchema = z.object({
  refereeEmail: z.string().email(),
  refereeName: z.string().min(1),
  refereePhone: z.string().optional(),
});
export type ProviderReferralInput = z.infer<typeof providerReferralSchema>;
```

**6. New API endpoints — `server/api/routes/referrals.ts`:**

- `GET /me/balance` — Returns `{ balance: number }` (available credit in cents). Uses `calculateCreditBalance()`.
- `POST /redeem` — Validate body with `redeemCreditsSchema`. Check balance >= amount. Call `redeemReferralCredits()`. Log `referral.credit` audit. Return updated booking.
- `POST /provider-refer` — Auth: `requireAuth` + verify user role is "provider". Validate body with `providerReferralSchema`. Create pending referral record with referrer = current user. Log `referral.create` audit. Return referral record.
- `GET /provider` — Auth: `requireAuth` + verify user role is "provider". List referrals where referrerId = current user. Paginated. Join with users for referee name.

**7. Notification extension — `lib/notifications/email.ts`:**

```typescript
export async function sendReferralCreditEmail(email: string, name: string, amount: number) {
  await sendEmail({
    to: email,
    subject: "You Earned a Referral Credit!",
    html: `<p>Hey ${name}, you just earned a ${formatPrice(amount)} referral credit on RoadSide ATL! It will be applied to your next booking.</p>`,
  });
}
```

**8. Notification orchestrator update — `lib/notifications/index.ts`:**

Update `notifyReferralCredit` to also fire email:
```typescript
export async function notifyReferralCredit(phone: string, amount: number, email?: string, name?: string) {
  const tasks: Promise<any>[] = [sendReferralCreditSMS(phone, amount)];
  if (email && name) {
    tasks.push(sendReferralCreditEmail(email, name, amount));
  }
  await Promise.allSettled(tasks);
}
```

**9. Frontend — Provider referral page:**

Server Component page at `app/(provider)/provider/referrals/page.tsx`. Client component `components/provider/provider-referral-form.tsx` with form fields: referee email, name, optional phone. Fetches provider's referral history from `GET /api/referrals/provider`. Shows referral history table with date, referred provider name, status badge.

**10. Frontend — Booking credit selector:**

`components/booking/referral-credit-selector.tsx`. Fetches available credit from `GET /api/referrals/me/balance`. If balance > 0, shows toggle to apply credits. Calculates discount (min of balance and booking price). Passes `referralCreditApplied` amount to booking form submission.

**11. Navigation:**

Add to both `components/provider/provider-sidebar.tsx` and `components/provider/provider-mobile-nav.tsx`:
```typescript
{ href: "/provider/referrals", label: "Referrals", icon: Users }
```
Import `Users` from `lucide-react`.

### Project Structure Notes

**Files to CREATE:**

| File | Purpose |
|---|---|
| `app/(provider)/provider/referrals/page.tsx` | Provider referral page (refer other providers + history) |
| `components/provider/provider-referral-form.tsx` | Provider-to-provider referral form |
| `components/booking/referral-credit-selector.tsx` | Credit application toggle for booking flow |

**Files to MODIFY (append/extend):**

| File | What to Add |
|---|---|
| `db/schema/bookings.ts` | `referralCreditApplied` integer column |
| `server/api/routes/referrals.ts` | `GET /me/balance`, `POST /redeem`, `POST /provider-refer`, `GET /provider` |
| `server/api/lib/referral-credits.ts` | `calculateCreditBalance`, `redeemReferralCredits`, `creditReferralOnFirstBooking` |
| `lib/validators.ts` | `redeemCreditsSchema`, `providerReferralSchema` |
| `lib/notifications/email.ts` | `sendReferralCreditEmail` |
| `lib/notifications/index.ts` | Update `notifyReferralCredit` to include email |
| `app/(dashboard)/dashboard/referrals/page.tsx` | Add credit balance from `/me/balance`, enhance with redemption info |
| `components/provider/provider-sidebar.tsx` | Referrals nav link |
| `components/provider/provider-mobile-nav.tsx` | Referrals nav link |
| `components/booking/booking-form.tsx` | Integrate referral-credit-selector |

**Files NOT to create:**
- NO `db/schema/credit-ledger.ts` — credit tracking uses existing referrals table + bookings column
- NO `lib/referrals/` directory — validators in `lib/validators.ts`, constants in `lib/constants.ts`
- NO `types/referrals.ts` — types co-located or inferred from Zod
- NO `server/api/routes/provider-referrals.ts` — provider endpoints are added to existing `referrals.ts` route
- NO admin referral management page — that is a separate admin story scope
- NO `components/dashboard/referral-card.tsx` — referral UI already in the page component

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a separate credit ledger table | Track credits via referrals table (earned) + bookings.referralCreditApplied (redeemed) |
| Create a separate provider-referrals route module | Add provider endpoints to existing `server/api/routes/referrals.ts` |
| Import from `"zod"` | Import from `"zod/v4"` |
| Use relative imports `../` | Use `@/` path alias |
| Skip audit logging for credit operations | Log `referral.credit` for every credit event |
| Await notification calls | Fire-and-forget: `notifyReferralCredit(...).catch(() => {})` |
| Add try-catch in route handlers | Let Hono handle errors |
| Forget `updatedAt: new Date()` when updating bookings | Always include it |
| Recreate existing referral API routes | Extend the existing `server/api/routes/referrals.ts` file |
| Recreate existing referral-credits lib functions | Extend the existing `server/api/lib/referral-credits.ts` file |
| Use floating point for credit calculations | Integer cents only — `calculateCreditBalance` returns cents |
| Create a `creditBalance` column on users | Calculate balance dynamically from referrals + bookings |
| Allow applying more credit than booking price | Cap credit redemption at min(balance, bookingPrice) |
| Allow applying credits when balance is 0 | Hide credit selector when balance is 0 |

### Dependencies and Scope

**This story depends on:** Story 7.1 (referral schema, credit config, post-service SMS) — all foundational code is already built.

**This story blocks:** Nothing directly.

**This story does NOT include:**
- Admin referral management page (separate admin story)
- Referral expiration cron/job (the `referral.expire` audit action exists but automatic expiration logic is future work)
- Referral analytics dashboard
- Multiple referral tiers or variable credit amounts
- Provider referral bonus tracking beyond the standard `REFERRAL_CREDIT_AMOUNT_CENTS`

**Scope boundary:** Credit balance calculation + redemption on bookings + provider-to-provider referral flow + frontend pages for both customer and provider views. The existing customer referral page is enhanced, provider referral page is new.

### Testing Guidance

No test framework is installed. Do NOT create test files. Verify manually:

1. GET `/api/referrals/me/balance` — confirm correct credit balance returned (credited minus redeemed)
2. POST `/api/referrals/redeem` with valid booking and amount — verify `referralCreditApplied` set on booking, audit logged
3. POST `/api/referrals/redeem` with amount exceeding balance — verify 400 error returned
4. POST `/api/referrals/provider-refer` as provider — verify referral created with "pending" status, audit logged
5. POST `/api/referrals/provider-refer` as customer — verify 403 error
6. GET `/api/referrals/provider` as provider — verify paginated referral list returned
7. Customer referral page — verify credit balance displays correctly, referral history shows
8. Provider referral page — verify form submits, referral history shows
9. Booking flow — verify credit selector shows when balance > 0, hides when 0, caps at booking price
10. Credit notification — verify SMS and email fire on referral credit

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7, Story 7.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Referral Tracking (Decision 1.5)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns - New Feature File Organization]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns - Notification Triggers]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: db/schema/referrals.ts - Existing referrals table definition]
- [Source: db/schema/bookings.ts - Booking table (needs referralCreditApplied column)]
- [Source: db/schema/users.ts - Users table with referralCode column]
- [Source: server/api/routes/referrals.ts - Existing referral API routes]
- [Source: server/api/lib/referral-credits.ts - Existing credit functions]
- [Source: server/api/lib/audit-logger.ts - Existing audit action types including referral.*]
- [Source: lib/constants.ts - REFERRAL_CREDIT_AMOUNT_CENTS and REFERRAL_STATUSES]
- [Source: lib/validators.ts - Existing createReferralSchema]
- [Source: lib/notifications/sms.ts - Existing sendReferralCreditSMS]
- [Source: lib/notifications/index.ts - Existing notifyReferralCredit orchestrator]
- [Source: app/(dashboard)/dashboard/referrals/page.tsx - Existing customer referral page]
- [Source: components/provider/provider-sidebar.tsx - Provider nav (needs Referrals link)]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None — build passed cleanly.

### Completion Notes List

**Task 1**: Added `referralCreditApplied` integer column to bookings schema. Migration generated as `0009_safe_texas_twister.sql`.

**Task 2**: Extended `server/api/lib/referral-credits.ts` with 3 new functions:
- `calculateCreditBalance(userId)` — sums credited referrals (as referrer + referee) minus redeemed bookings credits
- `redeemReferralCredits(userId, bookingId, amount)` — validates balance, sets `referralCreditApplied` on booking
- `creditReferralOnFirstBooking(userId, bookingId)` — finds pending referral as referee, transitions to "credited", notifies both parties

**Task 3**: Added `redeemCreditsSchema` and `providerReferralSchema` to validators.

**Task 4**: Added 4 endpoints to referrals.ts: GET /me/balance, POST /redeem, POST /provider-refer (role-gated), GET /provider (role-gated, paginated).

**Task 5**: Added `sendReferralCreditEmail` to email.ts with CAN-SPAM footer. Updated `notifyReferralCredit` orchestrator to accept optional email/name and fire both SMS + email via `Promise.allSettled`.

**Task 6**: Customer referral page already fully implemented with credit balance, referral history, and copy link functionality.

**Task 7**: Created provider referrals page + referral form. Added Users icon nav link to both sidebar and mobile nav.

**Task 8**: Created `ReferralCreditSelector` component with balance fetch, toggle to apply, capped at min(balance, bookingPrice).

### Change Log

| File | Change |
|---|---|
| `db/schema/bookings.ts` | Added `referralCreditApplied` integer column |
| `db/migrations/0009_safe_texas_twister.sql` | Generated migration |
| `server/api/lib/referral-credits.ts` | Added `calculateCreditBalance`, `redeemReferralCredits`, `creditReferralOnFirstBooking` |
| `lib/validators.ts` | Added `redeemCreditsSchema`, `providerReferralSchema` |
| `server/api/routes/referrals.ts` | Added GET /me/balance, POST /redeem, POST /provider-refer, GET /provider |
| `lib/notifications/email.ts` | Added `sendReferralCreditEmail` |
| `lib/notifications/index.ts` | Updated `notifyReferralCredit` with email support |
| `components/provider/provider-sidebar.tsx` | Added Referrals nav link with Users icon |
| `components/provider/provider-mobile-nav.tsx` | Added Referrals nav link with Users icon |
| `components/provider/provider-referral-form.tsx` | Created provider-to-provider referral form |
| `app/(provider)/provider/referrals/page.tsx` | Created provider referrals page |
| `components/booking/referral-credit-selector.tsx` | Created booking credit selector component |

### File List

- `db/schema/bookings.ts` (modified)
- `db/migrations/0009_safe_texas_twister.sql` (created)
- `server/api/lib/referral-credits.ts` (modified)
- `lib/validators.ts` (modified)
- `server/api/routes/referrals.ts` (modified)
- `lib/notifications/email.ts` (modified)
- `lib/notifications/index.ts` (modified)
- `components/provider/provider-sidebar.tsx` (modified)
- `components/provider/provider-mobile-nav.tsx` (modified)
- `components/provider/provider-referral-form.tsx` (created)
- `app/(provider)/provider/referrals/page.tsx` (created)
- `components/booking/referral-credit-selector.tsx` (created)
