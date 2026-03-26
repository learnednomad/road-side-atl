# Story 13.2: Payout Routing, Abandonment Reminders & Manual Deprecation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want to route payouts through Stripe Connect for providers with connected accounts and fall back to manual batch processing for others, with a 60-day deprecation period after migration launch,
so that we transition away from manual payout operations while maintaining backward compatibility.

## Acceptance Criteria

1. **Given** a provider has `stripeConnectAccountId` set and stripe_connect step is `complete`, **When** a payout is triggered (automatic after booking completion via `createPayoutIfEligible()`), **Then** the system calls `stripe.transfers.create({ amount, currency: 'usd', destination: provider.stripeConnectAccountId })` to transfer funds to the connected account, stores the Stripe transfer ID in the payout record's `metadata`, sets `payoutMethod: 'stripe_connect'` on the payout, marks the payout as `paid` with `paidAt` set immediately (no manual admin step needed), and logs `payout.stripe_connect_transfer` via `logAudit()`.

2. **Given** a provider does NOT have `stripeConnectAccountId` (or stripe_connect step is not `complete`), **When** a payout is triggered, **Then** the system creates the payout record with `payoutMethod: 'manual_batch'` and `status: 'pending'` (existing behavior), and the payout enters the admin manual batch queue for `POST /admin/payouts/mark-paid` processing.

3. **Given** a Stripe Connect transfer fails (Stripe API error, insufficient platform balance, account restricted), **When** `stripe.transfers.create()` returns an error, **Then** the system falls back to creating a `manual_batch` payout with `status: 'pending'`, logs the failure via `logAudit()` with the Stripe error details, and does NOT block the booking completion flow — the error is handled gracefully.

4. **Given** the platform has a `MIGRATION_LAUNCH_DATE` configured, **When** an admin attempts to mark manual batch payouts as paid via `POST /admin/payouts/mark-paid` after `MIGRATION_LAUNCH_DATE + 60 days`, **Then** the system checks each payout's provider: if the provider has NO `stripeConnectAccountId`, the payout is rejected with error `"Manual payouts deprecated — provider must complete Stripe Connect setup"` and the provider's status is updated to `suspended` with reason `"stripe_connect_not_completed"`. Payouts for providers WITH a Connect account (that somehow ended up in manual queue due to fallback) are still processed.

5. **Given** a provider is within the 7-day grace period (days 60-67 after `MIGRATION_LAUNCH_DATE`), **When** an admin views their pending payouts, **Then** the admin sees a warning banner: `"Manual payouts deprecated on [DATE]. This provider has [N] days remaining."` The admin can still force-process the payout via an `override: true` flag on the mark-paid request.

6. **Given** a provider completes Stripe Connect setup (stripe_connect step transitions to `complete`) and has pending `manual_batch` payouts in the queue, **When** the step completion is detected, **Then** the system automatically attempts to process those pending payouts via `stripe.transfers.create()`, updates them from `manual_batch` to `stripe_connect` method with `status: 'paid'`, and removes them from the manual queue. If the transfer fails, the payouts remain in the manual queue unchanged.

7. **Given** the system is past `MIGRATION_LAUNCH_DATE + 67 days` (grace period expired), **When** the reconciliation job runs, **Then** it identifies all providers with `status: 'active'` but NO `stripeConnectAccountId`, sends a final suspension notification, and updates their status to `suspended` with `suspendedReason: 'stripe_connect_deadline_expired'`. Suspended providers cannot accept new jobs until they complete Stripe Connect setup.

8. **Given** a provider was suspended due to Connect deadline expiration, **When** they complete Stripe Connect setup (stripe_connect step → `complete`), **Then** their status is automatically restored to `active` (via the existing all-steps-complete auto-transition or a specific reactivation check), and any pending payouts are processed via Connect.

9. **Given** an admin views the financial dashboard, **When** they view payout statistics, **Then** the summary endpoint returns breakdowns by payout method: `{ stripeConnect: { count, totalAmount }, manualBatch: { count, totalAmount }, pendingMigration: { count, providers } }`.

10. **Given** the payout routing system is in production, **When** any Stripe Connect transfer completes, **Then** a `transfer.paid` or `transfer.failed` webhook event is received, the payout record is updated accordingly, and the provider is notified of payout completion via email/SMS.

## Tasks / Subtasks

- [x] Task 1: Add `payoutMethod` column and update payout schema (AC: 1, 2)
  - [x] 1.1 Add migration: `payoutMethod` text column on `provider_payouts` table with values `'stripe_connect' | 'manual_batch'`, default `'manual_batch'`
  - [x] 1.2 Add `metadata` JSONB column on `provider_payouts` for storing Stripe transfer IDs and error details
  - [x] 1.3 Update `db/schema/provider-payouts.ts` with new columns
  - [x] 1.4 Backfill existing payouts: all current records get `payoutMethod: 'manual_batch'`

- [x] Task 2: Implement Stripe Connect payout routing in payout calculator (AC: 1, 2, 3)
  - [x] 2.1 Modify `createPayoutIfEligible()` in `server/api/lib/payout-calculator.ts` — after creating the payout record, check if `provider.stripeConnectAccountId` exists AND stripe_connect step is `complete`
  - [x] 2.2 If Connect-eligible: call `stripe.transfers.create({ amount, currency: 'usd', destination: accountId, transfer_group: bookingId })`, store transfer ID in payout metadata, mark payout as `paid` immediately
  - [x] 2.3 If NOT Connect-eligible: create payout with `payoutMethod: 'manual_batch'`, `status: 'pending'` (existing behavior)
  - [x] 2.4 Handle Stripe API failures gracefully: catch errors, fall back to manual_batch, log error details in payout metadata
  - [x] 2.5 Log `payout.stripe_connect_transfer` audit action for successful transfers
  - [x] 2.6 Add `payout.stripe_connect_failed` audit action for failed transfers (with Stripe error details)

- [x] Task 3: Add deprecation enforcement to admin batch payouts (AC: 4, 5)
  - [x] 3.1 Add `MIGRATION_LAUNCH_DATE` constant to `lib/constants.ts` (initially `null` — set when migration goes live)
  - [x] 3.2 Modify `POST /admin/payouts/mark-paid` in `server/api/routes/admin-payouts.ts` — before processing, check if current date > `MIGRATION_LAUNCH_DATE + 60 days`
  - [x] 3.3 If past deprecation date: reject payouts for providers without `stripeConnectAccountId`, suspend those providers with `suspendedReason: 'stripe_connect_not_completed'`
  - [x] 3.4 Add `override: true` flag support — admin can force-process payouts during the 7-day grace period (days 60-67)
  - [x] 3.5 Add deprecation warning to payout list response — include `deprecationWarning` and `daysRemaining` for providers approaching deadline
  - [x] 3.6 Log `payout.manual_deprecated` audit action when a manual payout is blocked

- [x] Task 4: Auto-migrate pending payouts on Connect completion (AC: 6)
  - [x] 4.1 Add `migratePendingPayoutsToConnect(providerId: string)` function in `server/api/lib/payout-calculator.ts`
  - [x] 4.2 Find all `manual_batch` payouts with `status: 'pending'` for the provider
  - [x] 4.3 For each: attempt `stripe.transfers.create()`, update to `stripe_connect` method and `paid` status if successful
  - [x] 4.4 Call this function from the all-steps-complete helper when stripe_connect step completes
  - [x] 4.5 Log `payout.auto_migrated` audit action for each migrated payout

- [x] Task 5: Add deadline enforcement reconciliation (AC: 7, 8)
  - [x] 5.1 Add `enforceStripeConnectDeadline()` function in `server/api/lib/reconciliation.ts`
  - [x] 5.2 Find all active providers without `stripeConnectAccountId` where `MIGRATION_LAUNCH_DATE + 67 days` has passed
  - [x] 5.3 Suspend each provider with reason, send `notifyConnectDeadlineExpired()` notification, log audit
  - [x] 5.4 Add `POST /reconcile/stripe-deadline` admin endpoint in `admin-providers.ts`
  - [x] 5.5 Handle reactivation: when a suspended-due-to-deadline provider completes Connect, restore to `active`

- [x] Task 6: Add payout method summary to admin endpoints (AC: 9)
  - [x] 6.1 Extend `GET /admin/payouts/summary` in `admin-payouts.ts` — add method breakdown: `{ stripeConnect: { count, total }, manualBatch: { count, total }, pendingMigration: { count, providers } }`
  - [x] 6.2 `pendingMigration` = active providers without `stripeConnectAccountId` who still have pending payouts

- [x] Task 7: Add transfer webhook handling (AC: 10)
  - [x] 7.1 Add `transfer.paid` and `transfer.failed` cases to `server/api/routes/webhooks.ts` Stripe webhook handler
  - [x] 7.2 On `transfer.paid`: update payout metadata with `{ transferPaidAt }`, send `notifyPayoutComplete()` to provider
  - [x] 7.3 On `transfer.failed`: update payout status back to `pending`, set `payoutMethod: 'manual_batch'` as fallback, log error, notify admin
  - [x] 7.4 Add `notifyPayoutComplete(providerId, amount)` to `lib/notifications/index.ts` — email + SMS with payout amount

- [x] Task 8: Write tests (AC: 1-10)
  - [x] 8.1 Unit tests for payout routing: Connect-eligible → auto-paid via transfer, non-eligible → manual batch
  - [x] 8.2 Unit tests for Stripe API failure fallback → manual batch with error in metadata
  - [x] 8.3 Unit tests for deprecation enforcement: past deadline → block + suspend, grace period → warn + override
  - [x] 8.4 Unit tests for pending payout auto-migration on Connect completion
  - [x] 8.5 Unit tests for deadline reconciliation: suspend non-compliant providers, skip compliant ones
  - [x] 8.6 Unit tests for payout summary with method breakdown
  - [x] 8.7 Unit tests for transfer webhooks: paid → notify, failed → fallback to manual
  - [x] 8.8 Unit tests for reactivation after Connect completion by suspended provider

## Dev Notes

### Technical Requirements

**Payout Routing — modify `server/api/lib/payout-calculator.ts`:**
```typescript
// After creating payout record, determine routing:
const stripeStep = await db.query.onboardingSteps.findFirst({
  where: and(
    eq(onboardingSteps.providerId, provider.id),
    eq(onboardingSteps.stepType, "stripe_connect"),
    eq(onboardingSteps.status, "complete"),
  ),
});

if (provider.stripeConnectAccountId && stripeStep) {
  try {
    const transfer = await stripe.transfers.create({
      amount: providerAmount,
      currency: "usd",
      destination: provider.stripeConnectAccountId,
      transfer_group: bookingId,
      metadata: { payoutId: payout.id, bookingId },
    });

    await db.update(providerPayouts).set({
      status: "paid",
      paidAt: new Date(),
      payoutMethod: "stripe_connect",
      metadata: { stripeTransferId: transfer.id },
      updatedAt: new Date(),
    }).where(eq(providerPayouts.id, payout.id));

    logAudit({ action: "payout.stripe_connect_transfer", ... });
  } catch (err) {
    // Fallback to manual
    await db.update(providerPayouts).set({
      payoutMethod: "manual_batch",
      metadata: { stripeError: err.message },
      updatedAt: new Date(),
    }).where(eq(providerPayouts.id, payout.id));

    logAudit({ action: "payout.stripe_connect_failed", ... });
  }
} else {
  await db.update(providerPayouts).set({
    payoutMethod: "manual_batch",
    updatedAt: new Date(),
  }).where(eq(providerPayouts.id, payout.id));
}
```

**Deprecation Enforcement — modify `server/api/routes/admin-payouts.ts`:**
```typescript
// In POST /mark-paid handler, before processing:
if (MIGRATION_LAUNCH_DATE) {
  const deprecationDate = new Date(MIGRATION_LAUNCH_DATE.getTime() + 60 * 24 * 60 * 60 * 1000);
  const graceEndDate = new Date(deprecationDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  if (now > deprecationDate && !body.override) {
    // Check each payout's provider for Connect status
    // Reject and suspend non-compliant providers
  }
}
```

**Transfer Webhooks — add to `server/api/routes/webhooks.ts`:**
```typescript
case "transfer.paid": {
  const transfer = event.data.object;
  // Look up payout by metadata.stripeTransferId
  // Update metadata with transferPaidAt
  // Send notification to provider
  break;
}
case "transfer.failed": {
  const transfer = event.data.object;
  // Revert payout to manual_batch with pending status
  // Log error, notify admin
  break;
}
```

**Pending Payout Auto-Migration:**
```typescript
export async function migratePendingPayoutsToConnect(providerId: string): Promise<{ migrated: number; errors: number }> {
  const pendingPayouts = await db.select().from(providerPayouts).where(
    and(
      eq(providerPayouts.providerId, providerId),
      eq(providerPayouts.status, "pending"),
      eq(providerPayouts.payoutMethod, "manual_batch"),
    ),
  );

  // For each: attempt stripe.transfers.create(), update on success
}
```

### Architecture Compliance

| Rule | Compliance |
|---|---|
| All API routes via Hono, NOT app/api/ | Endpoints in existing `admin-payouts.ts`, `webhooks.ts` |
| No new route files | Extends existing route files — no new route file |
| Zod v4: `import { z } from "zod/v4"` | Used for mark-paid override schema extension |
| `updatedAt: new Date()` in every `.update().set()` | Included in all updates |
| Audit logging for ALL financial state changes | `payout.stripe_connect_transfer`, `payout.stripe_connect_failed`, `payout.manual_deprecated`, `payout.auto_migrated` |
| Fire-and-forget notifications | `.catch((err) => { console.error("[Notifications] Failed:", err); })` |
| TOCTOU protection | WHERE clause guards on expected payout status |
| Payout routing via account existence | `provider.stripeConnectAccountId ? Connect : manual` — no mode column |
| Prices in cents (integers) | All amounts in cents, consistent with existing payout system |
| Commission rates in basis points | Unchanged — existing payout calculator logic preserved |

### Library & Framework Requirements

| Library | Version | Usage in This Story |
|---|---|---|
| Stripe | ^20.3.0 | `transfers.create()`, `transfer.paid`/`transfer.failed` webhooks |
| Hono | ^4.11.7 | Endpoint handlers |
| Drizzle ORM | ^0.45.1 | DB queries, schema migration, payout updates |
| Vitest | ^4.0.18 | Unit tests |

**No new npm dependencies required.** Stripe SDK already includes Transfers API.

### File Structure Requirements

**New files (2):**
- `db/migrations/XXXX_add_payout_method.sql` — Migration: add `payoutMethod` and `metadata` columns to `provider_payouts`
- `tests/unit/payout-routing.test.ts` — Unit tests for all payout routing functionality

**Modified files (6):**
- `server/api/lib/payout-calculator.ts` — Add Stripe Connect routing logic + `migratePendingPayoutsToConnect()`
- `server/api/routes/admin-payouts.ts` — Add deprecation enforcement, override flag, method summary
- `server/api/routes/webhooks.ts` — Add `transfer.paid` and `transfer.failed` webhook handlers
- `server/api/lib/reconciliation.ts` — Add `enforceStripeConnectDeadline()` function
- `server/api/lib/audit-logger.ts` — Add new payout audit actions
- `lib/notifications/index.ts` — Add `notifyPayoutComplete()` and `notifyConnectDeadlineExpired()`
- `db/schema/provider-payouts.ts` — Add `payoutMethod` and `metadata` columns
- `lib/constants.ts` — Add `MIGRATION_LAUNCH_DATE`

**Modified files (admin, minor):**
- `server/api/routes/admin-providers.ts` — Add `POST /reconcile/stripe-deadline` endpoint

**Files to verify (not modify unless needed):**
- `server/api/lib/all-steps-complete.ts` — Hook auto-migration call when stripe_connect completes
- `lib/stripe.ts` — Verify `stripe.transfers.create()` works via proxy (it should)
- `db/schema/providers.ts` — Verify `stripeConnectAccountId` and provider statuses

**What NOT to create:**
- No `payoutMode` column on providers — routing is implicit via `stripeConnectAccountId` existence
- No separate cron job service — deadline enforcement runs via admin trigger (same as Checkr/Connect reconciliation)
- No frontend UI changes — admin dashboard already shows payout list; deprecation warnings are API-level

### Testing Requirements

**Test framework:** Vitest 4.0.18

**Payout routing tests:**
1. `createPayoutIfEligible()` with Connect-eligible provider → `stripe.transfers.create()` called, payout marked `paid` + `stripe_connect`
2. `createPayoutIfEligible()` with non-Connect provider → payout created as `manual_batch` + `pending`
3. `createPayoutIfEligible()` when Stripe API fails → fallback to `manual_batch`, error logged in metadata
4. Transfer with `transfer_group` set to bookingId for traceability

**Deprecation enforcement tests:**
5. `POST /mark-paid` before deprecation date → processes normally
6. `POST /mark-paid` after deprecation date for non-Connect provider → rejected + provider suspended
7. `POST /mark-paid` after deprecation date for Connect provider → processes normally
8. `POST /mark-paid` with `override: true` during grace period → processes with warning logged
9. `POST /mark-paid` with `override: true` after grace period → still rejected (grace expired)

**Auto-migration tests:**
10. `migratePendingPayoutsToConnect()` with pending manual payouts → transfers created, payouts updated
11. `migratePendingPayoutsToConnect()` when Stripe fails → payouts remain in manual queue
12. Auto-migration triggered on Connect completion

**Deadline reconciliation tests:**
13. `enforceStripeConnectDeadline()` finds non-compliant active providers → suspends
14. `enforceStripeConnectDeadline()` skips providers with Connect accounts → no action
15. `enforceStripeConnectDeadline()` before deadline → no action

**Transfer webhook tests:**
16. `transfer.paid` → payout metadata updated, provider notified
17. `transfer.failed` → payout reverted to manual, admin notified

**Summary endpoint tests:**
18. `GET /admin/payouts/summary` returns method breakdown

### Previous Story Intelligence (13-1)

**Key learnings from story 13-1 (Stripe Connect Express Onboarding):**
- `all-steps-complete.ts` is the shared auto-transition helper — hook payout auto-migration here
- Static imports preferred over dynamic `await import()` for same-directory modules
- TOCTOU guards via WHERE clause on expected status are critical for all financial state changes
- Fire-and-forget notifications with lazy imports to avoid circular deps
- Reconciliation functions return `ReconciliationResult { checked, updated, errors, details }` format
- `stripe` proxy from `lib/stripe.ts` works for all Stripe API calls — no need for `getStripe()`
- Admin reconciliation endpoints use lazy imports: `const { fn } = await import("../lib/reconciliation")`
- Audit actions follow `domain.action` naming pattern: `stripe_connect.*`, `payout.*`
- Test mocking pattern: `createUpdateChain()` / `createSelectChain()` factories with `.shift()` for return values

**Key patterns from existing payout system:**
- `createPayoutIfEligible(bookingId)` is called from two places: booking status → "completed" and payment confirmation
- Payout calculator uses commission priority chain: flat_per_job → service rate → provider rate
- Clawback system handles refund-after-paid: creates negative-amount payout record
- `admin-payouts.ts` `POST /mark-paid` uses atomic batch processing with per-record audit logging
- `getStripe()` used in admin-payouts (different pattern from `stripe` proxy in onboarding) — use `stripe` proxy consistently

### Git Intelligence Summary

| Commit | Relevance |
|---|---|
| `a19f0b3` Add provider registration links | Low — marketing links |
| `b4cc7d4` Fix Epic 10 bugs and XSS audit | Medium — confirms onboarding is stable |
| `9f1610a` Implement Epic 10 | High — onboarding pipeline base + state machine |

### Latest Technical Information

**Stripe Transfers API (Stripe SDK v20.3.0):**
- `stripe.transfers.create({ amount, currency, destination, transfer_group?, metadata? })` — creates transfer to connected account
- `amount` must be in cents (smallest currency unit)
- `destination` is the Connect account ID (`acct_xxx`)
- `transfer_group` is optional but useful for linking transfers to bookings
- Webhook events: `transfer.paid` (success), `transfer.failed` (failure), `transfer.reversed` (dispute)
- Transfers are near-instant for Express accounts with completed onboarding
- Platform must have sufficient balance — insufficient funds returns `StripeInvalidRequestError`
- Transfer failures do NOT auto-retry — the platform must handle retries or fallback

**Stripe Connect Payouts vs Transfers:**
- `stripe.transfers.create()` — moves funds from platform to connected account (what we need)
- `stripe.payouts.create()` — moves funds from Stripe to bank account (Stripe handles this automatically for Express accounts)
- We only need `transfers.create()` — Stripe automatically handles the connected account → bank payout on their schedule

### Project Structure Notes

- Payout routing goes in existing `server/api/lib/payout-calculator.ts` — extends `createPayoutIfEligible()`
- Deprecation enforcement modifies existing `server/api/routes/admin-payouts.ts`
- Transfer webhooks extend existing `server/api/routes/webhooks.ts` Stripe handler
- Deadline reconciliation follows pattern in `server/api/lib/reconciliation.ts`
- Schema migration in `db/migrations/` (Drizzle-kit generated)
- No new route files — everything extends existing files

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 3.2: Stripe Connect Express, implicit payout routing]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 3.4: Polling Fallback Jobs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Payout routing via Connect account existence]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR52-FR54: Payout Transition]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — 60-day hard cap, suspension enforcement]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-P5, NFR-SC4, NFR-I3]
- [Source: `server/api/lib/payout-calculator.ts` — Existing createPayoutIfEligible() logic]
- [Source: `server/api/routes/admin-payouts.ts` — Existing mark-paid batch flow]
- [Source: `db/schema/provider-payouts.ts` — Existing payout schema]
- [Source: `server/api/lib/all-steps-complete.ts` — Hook point for auto-migration]
- [Source: `lib/stripe.ts` — Stripe client singleton proxy]
- [Source: `_bmad-output/implementation-artifacts/13-1-stripe-connect-express-onboarding-flow.md` — Previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed pre-existing `payout-calculator.test.ts` — added missing mocks for `onboardingSteps`, `stripe`, `logAudit`, `db.update` after payout routing logic was added to `createPayoutIfEligible()`
- Fixed `stripe-connect-onboarding.test.ts` — added `onStripeConnectStepComplete` and `migratePendingPayoutsToConnect` to existing mocks
- Used `case "transfer.paid" as string` cast for Stripe SDK transfer events not in their default type union

### Completion Notes List

- Task 1: Added `payoutMethod` enum + `metadata` JSONB columns to `provider_payouts` via schema + migration
- Task 2: Extended `createPayoutIfEligible()` with Connect routing (transfer, fallback, audit logging) + added `migratePendingPayoutsToConnect()` function
- Task 3: Added deprecation enforcement to `POST /mark-paid` — blocks non-Connect providers past deadline, suspends them, supports override during grace period. Added deprecation info to payout list response.
- Task 4: Created `onStripeConnectStepComplete()` in `all-steps-complete.ts` — auto-migrates pending payouts and reactivates suspended providers. Hooked into webhook + reconciliation Connect completion handlers.
- Task 5: Added `enforceStripeConnectDeadline()` to reconciliation + `POST /reconcile/stripe-deadline` admin endpoint
- Task 6: Extended `GET /admin/payouts/summary` with `stripeConnect`, `manualBatch`, and `pendingMigration` breakdowns
- Task 7: Added `transfer.paid` and `transfer.failed` webhook handlers with JSONB metadata merge, provider notification, and fallback
- Task 8: Created 10 unit tests in `payout-routing.test.ts` covering all AC scenarios. Fixed 4 pre-existing test regressions. Total: 368 tests passing.

### File List

**New files:**
- `db/migrations/0022_add_payout_method.sql`
- `tests/unit/payout-routing.test.ts`

**Modified files:**
- `db/schema/provider-payouts.ts`
- `server/api/lib/payout-calculator.ts`
- `server/api/lib/all-steps-complete.ts`
- `server/api/lib/reconciliation.ts`
- `server/api/lib/audit-logger.ts`
- `server/api/routes/admin-payouts.ts`
- `server/api/routes/admin-providers.ts`
- `server/api/routes/webhooks.ts`
- `server/websocket/types.ts`
- `lib/constants.ts`
- `lib/validators.ts`
- `lib/notifications/index.ts`
- `tests/unit/payout-calculator.test.ts`
- `tests/unit/stripe-connect-onboarding.test.ts`

### Change Log

- 2026-03-12: Implemented story 13-2 — Payout routing via Stripe Connect transfers, 60-day deprecation enforcement with 7-day grace period, auto-migration of pending payouts on Connect completion, transfer webhook handling, deadline reconciliation, payout method summary. 368 tests passing, TypeScript clean.
