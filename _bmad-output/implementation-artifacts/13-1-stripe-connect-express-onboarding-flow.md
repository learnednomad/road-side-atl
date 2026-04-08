# Story 13.1: Stripe Connect Express Onboarding Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a provider,
I want to set up Stripe Connect Express from my onboarding dashboard so I can receive automated payouts,
so that I don't need to share bank details with the platform and can manage my payout info directly through Stripe's secure dashboard.

## Acceptance Criteria

1. **Given** a provider is on the onboarding dashboard with the "Payment Setup" (stripe_connect) step in `pending` status, **When** the provider clicks the "Set Up Payments" button, **Then** the system creates a Stripe Connect Express account via `stripe.accounts.create({ type: 'express' })`, stores the `accountId` in `providers.stripeConnectAccountId`, transitions the step from `pending` to `in_progress`, stores `{ stripeConnectAccountId }` in the step's `metadata` JSONB, generates an onboarding link via `stripe.accountLinks.create()` with `return_url` and `refresh_url`, logs `stripe_connect.account_created` via `logAudit()`, and returns the onboarding link URL to the provider.

2. **Given** a provider has already started Stripe Connect setup (step is `in_progress` with a `stripeConnectAccountId` in metadata), **When** the provider clicks "Continue Setup", **Then** the system generates a new `accountLinks.create()` link (refresh flow) using the existing account ID, logs `stripe_connect.link_generated`, and returns the link — it does NOT create a second account.

3. **Given** a provider has completed Stripe's hosted onboarding flow, **When** the provider is redirected back to the return URL (`/provider/onboarding?stripe=complete`), **Then** the onboarding dashboard detects the `stripe=complete` query param, calls `GET /api/provider/onboarding/stripe-status` to verify the account status, and if `charges_enabled === true`, the step transitions from `in_progress` to `complete` with `completedAt` set, and the all-steps-complete auto-transition check runs.

4. **Given** a provider returns from Stripe but `charges_enabled` is not yet true, **When** the status check runs, **Then** the step remains `in_progress` and the provider sees a "Verification in progress" message with an option to re-enter the Stripe flow.

5. **Given** a Stripe `account.updated` webhook fires for a connected account, **When** the webhook handler processes the event, **Then** it looks up the provider by `stripeConnectAccountId`, checks if `charges_enabled` flipped to `true`, transitions the stripe_connect step from `in_progress` to `complete` (via `isValidStepTransition()`), logs `stripe_connect.onboarding_completed`, broadcasts `onboarding:step_updated` to the provider via WebSocket, and runs the all-steps-complete auto-transition check.

6. **Given** a provider started Stripe Connect setup but hasn't completed it after 24 hours, **When** the abandonment reminder system checks, **Then** a reminder notification (email + SMS) is sent to the provider with a link to re-enter the Stripe flow. A second reminder is sent at 72 hours if still incomplete.

7. **Given** a Stripe Connect account has been created but `charges_enabled` has not been confirmed via webhook within 4 hours, **When** the `reconcileStripeConnectStatuses()` polling function runs, **Then** it calls `stripe.accounts.retrieve(accountId)` for each stale account, and if `details_submitted === true && charges_enabled === true`, it transitions the step to `complete` and runs the all-steps-complete check. (NFR-I3, NFR-SC4)

8. **Given** the Stripe API is unavailable when a provider tries to create their Connect account, **When** the `stripe.accounts.create()` call fails, **Then** the system returns `503` with `{ error: "Payment setup temporarily unavailable" }`, the step status remains `pending`, and the error is logged.

9. **Given** an admin views the pipeline at `GET /api/admin/providers/pipeline`, **When** there are providers with `in_progress` stripe_connect steps, **Then** these providers appear in the existing `stripe_setup` stage (already implemented in admin-providers.ts pipeline).

10. **Given** a provider has completed Stripe Connect onboarding, **When** the provider wants to update their bank info or tax details, **Then** the provider can access Stripe's Express Dashboard directly (no admin intermediary needed) — the platform provides a "Manage Payout Settings" link that opens Stripe's Express Dashboard login flow.

## Tasks / Subtasks

- [x] Task 1: Create Stripe Connect account and link generation endpoint (AC: 1, 2, 8)
  - [x] 1.1 Add `POST /stripe-link` endpoint in `server/api/routes/onboarding.ts` — creates Connect Express account if none exists, generates onboarding link with `return_url` and `refresh_url`
  - [x] 1.2 If `providers.stripeConnectAccountId` already exists, skip account creation and generate a new link using existing account ID (refresh/re-entry flow)
  - [x] 1.3 Store `stripeConnectAccountId` in both `providers` table and step `metadata` JSONB
  - [x] 1.4 Transition step from `pending` to `in_progress` via `isValidStepTransition()`
  - [x] 1.5 Handle Stripe API failure: return 503, don't transition step, log error
  - [x] 1.6 Log `stripe_connect.account_created` and `stripe_connect.link_generated` audit events

- [x] Task 2: Add Stripe Connect status check endpoint (AC: 3, 4)
  - [x] 2.1 Add `GET /stripe-status` endpoint in `server/api/routes/onboarding.ts` — retrieves account via `stripe.accounts.retrieve(accountId)`, checks `details_submitted` and `charges_enabled`
  - [x] 2.2 If `charges_enabled === true`: transition step to `complete`, set `completedAt`, run all-steps-complete auto-transition check, broadcast WebSocket update, log `stripe_connect.onboarding_completed`
  - [x] 2.3 If not yet enabled: return `{ status: "pending", details_submitted: boolean }` — no status change
  - [x] 2.4 Handle case where provider has no `stripeConnectAccountId` — return 404

- [x] Task 3: Add Stripe Connect Express Dashboard link endpoint (AC: 10)
  - [x] 3.1 Add `GET /stripe-dashboard` endpoint in `server/api/routes/onboarding.ts` — generates login link via `stripe.accounts.createLoginLink(accountId)` for providers with completed Connect setup
  - [x] 3.2 Only allow access when stripe_connect step is `complete` — return 403 otherwise

- [x] Task 4: Add `account.updated` webhook handler (AC: 5)
  - [x] 4.1 Add `account.updated` case in `server/api/routes/webhooks.ts` Stripe webhook handler
  - [x] 4.2 Look up provider by `stripeConnectAccountId` matching event `account` field
  - [x] 4.3 If `charges_enabled === true` and step is `in_progress`: transition to `complete`, set `completedAt`, store verification timestamp in metadata
  - [x] 4.4 TOCTOU guard: WHERE clause on expected `in_progress` status
  - [x] 4.5 Run all-steps-complete auto-transition check, broadcast WebSocket, log audit

- [x] Task 5: Add Stripe Connect reconciliation polling (AC: 7)
  - [x] 5.1 Add `reconcileStripeConnectStatuses()` function in `server/api/lib/reconciliation.ts`
  - [x] 5.2 Query providers where `stripeConnectAccountId IS NOT NULL` and stripe_connect step `status = 'in_progress'` and `updatedAt < NOW() - 4h`
  - [x] 5.3 For each stale account: call `stripe.accounts.retrieve()`, check `charges_enabled`
  - [x] 5.4 Transition to complete if enabled, log audit, broadcast, run all-steps-complete check
  - [x] 5.5 Add `POST /reconcile/stripe-connect` endpoint in `admin-providers.ts` to trigger manually
  - [x] 5.6 Return `ReconciliationResult` format matching Checkr reconciliation pattern

- [x] Task 6: Add abandonment reminder notifications (AC: 6)
  - [x] 6.1 Add `notifyStripeConnectReminder(providerId, hoursElapsed)` to `lib/notifications/index.ts`
  - [x] 6.2 Include a re-entry link in the reminder (link to onboarding dashboard)
  - [x] 6.3 Send both email and SMS following existing dual-channel pattern
  - [x] 6.4 Add `checkStripeConnectAbandonment()` function in `server/api/lib/reconciliation.ts` — finds providers with `in_progress` stripe_connect step older than 24h (first reminder) or 72h (second reminder), checks metadata for `remindersSent` count
  - [x] 6.5 Add `POST /reconcile/stripe-reminders` endpoint in `admin-providers.ts`

- [x] Task 7: Write tests (AC: 1-10)
  - [x] 7.1 Unit tests for `POST /stripe-link`: new account creation, re-entry flow, Stripe API failure → 503, audit logging
  - [x] 7.2 Unit tests for `GET /stripe-status`: account enabled → step complete, account pending → no change, no account → 404
  - [x] 7.3 Unit tests for `account.updated` webhook: charges_enabled transition, TOCTOU guard, all-steps-complete check
  - [x] 7.4 Unit tests for reconciliation: stale accounts polled, enabled accounts transitioned
  - [x] 7.5 Unit tests for abandonment reminders: 24h and 72h thresholds, deduplication via metadata

## Dev Notes

### Technical Requirements

**Stripe Connect Account Creation — add to `server/api/routes/onboarding.ts`:**
```typescript
// POST /stripe-link — Generate Stripe Connect onboarding link
app.post("/stripe-link", async (c) => {
  const user = c.get("user");
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, user.providerId),
  });

  let accountId = provider.stripeConnectAccountId;

  if (!accountId) {
    // Create new Express account
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      metadata: { providerId: provider.id },
    });
    accountId = account.id;

    // Store account ID
    await db.update(providers)
      .set({ stripeConnectAccountId: accountId, updatedAt: new Date() })
      .where(eq(providers.id, provider.id));

    // Update step metadata
    const step = await findStep(provider.id, "stripe_connect");
    await db.update(onboardingSteps)
      .set({
        status: "in_progress",
        metadata: { stripeConnectAccountId: accountId },
        updatedAt: new Date(),
      })
      .where(and(eq(onboardingSteps.id, step.id), eq(onboardingSteps.status, "pending")));
  }

  // Generate onboarding link (works for both new and re-entry)
  const link = await stripe.accountLinks.create({
    account: accountId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/provider/onboarding?stripe=complete`,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/provider/onboarding?stripe=refresh`,
    type: "account_onboarding",
  });

  logAudit({ action: "stripe_connect.link_generated", ... });
  return c.json({ url: link.url });
});
```

**Stripe Connect Status Check:**
```typescript
// GET /stripe-status — Check Connect account readiness
app.get("/stripe-status", async (c) => {
  const provider = ...;
  if (!provider.stripeConnectAccountId) return c.json({ error: "No Connect account" }, 404);

  const account = await stripe.accounts.retrieve(provider.stripeConnectAccountId);

  if (account.charges_enabled) {
    // Transition step to complete (with TOCTOU guard)
    // Run all-steps-complete check
    // Log stripe_connect.onboarding_completed
    return c.json({ status: "complete", charges_enabled: true, details_submitted: true });
  }

  return c.json({
    status: "pending",
    charges_enabled: false,
    details_submitted: account.details_submitted || false,
  });
});
```

**Webhook Handler Extension — add to `server/api/routes/webhooks.ts`:**
```typescript
case "account.updated": {
  const account = event.data.object as Stripe.Account;
  if (!account.charges_enabled) break; // Only care about enabled

  const provider = await db.query.providers.findFirst({
    where: eq(providers.stripeConnectAccountId, account.id),
  });
  if (!provider) break; // Orphan event

  // Find stripe_connect step, transition in_progress → complete
  // TOCTOU guard, all-steps-complete check, broadcast, audit
  break;
}
```

**Reconciliation Polling — add to `server/api/lib/reconciliation.ts`:**
```typescript
export async function reconcileStripeConnectStatuses(): Promise<ReconciliationResult> {
  const threshold = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours

  // Find stale stripe_connect steps
  const staleSteps = await db.select().from(onboardingSteps)
    .where(and(
      eq(onboardingSteps.stepType, "stripe_connect"),
      eq(onboardingSteps.status, "in_progress"),
      lt(onboardingSteps.updatedAt, threshold),
    ));

  // For each: retrieve account, check charges_enabled, transition if ready
  // Follow exact same pattern as reconcileCheckrStatuses()
}
```

### Architecture Compliance

| Rule | Compliance |
|---|---|
| All API routes via Hono, NOT app/api/ | Endpoints in existing `onboarding.ts` and `webhooks.ts` |
| No new route files | Extends existing route files — no new route file |
| Zod v4: `import { z } from "zod/v4"` | Not needed — no request body validation (Stripe handles form) |
| `updatedAt: new Date()` in every `.update().set()` | Included in all updates |
| Audit logging for ALL state changes | `stripe_connect.account_created`, `stripe_connect.link_generated`, `stripe_connect.onboarding_completed` |
| Fire-and-forget notifications | `.catch((err) => { console.error("[Notifications] Failed:", err); })` |
| State machine transitions | All step status changes go through `isValidStepTransition()` |
| TOCTOU protection | WHERE clause guards on expected current status |
| Use existing `stripe` from `lib/stripe.ts` | No new dependency — `stripe` v20.3.0 includes Connect API |
| Payout routing via account existence | `provider.stripeConnectAccountId ? Connect : manual` — no mode column |
| `requireProvider` middleware | All provider onboarding endpoints already protected |

### Library & Framework Requirements

| Library | Version | Usage in This Story |
|---|---|---|
| Stripe | ^20.3.0 | `accounts.create()`, `accountLinks.create()`, `accounts.retrieve()`, `accounts.createLoginLink()` |
| Hono | ^4.11.7 | Endpoint handlers |
| Drizzle ORM | ^0.45.1 | DB queries, step status updates |
| Vitest | ^4.0.18 | Unit tests |

**No new npm dependencies required.** Stripe SDK already installed and includes Connect API.

### File Structure Requirements

**New files (1):**
- `tests/unit/stripe-connect-onboarding.test.ts` — Unit tests for all Stripe Connect onboarding functionality

**Modified files (4):**
- `server/api/routes/onboarding.ts` — Add `POST /stripe-link`, `GET /stripe-status`, `GET /stripe-dashboard` endpoints
- `server/api/routes/webhooks.ts` — Add `account.updated` webhook handler case
- `server/api/lib/reconciliation.ts` — Add `reconcileStripeConnectStatuses()` and `checkStripeConnectAbandonment()`
- `lib/notifications/index.ts` — Add `notifyStripeConnectReminder()` function

**Modified files (admin, minor):**
- `server/api/routes/admin-providers.ts` — Add `POST /reconcile/stripe-connect` and `POST /reconcile/stripe-reminders` endpoints

**Files to verify (not modify unless needed):**
- `lib/stripe.ts` — Verify `stripe` proxy works for Connect API calls (it should — `accounts.create()` is on the Stripe client)
- `db/schema/providers.ts` — Verify `stripeConnectAccountId` column exists (line 55 — confirmed)
- `server/api/lib/audit-logger.ts` — Verify `stripe_connect.*` audit actions exist (lines 92-94 — confirmed)
- `components/onboarding/step-card.tsx` — Verify step card recognizes `stripe_connect` type (lines 48-52 — confirmed)

**What NOT to create:**
- No new route files — everything goes in existing `onboarding.ts`, `webhooks.ts`, `admin-providers.ts`
- No schema migration — `stripeConnectAccountId` column already exists in providers table
- No new Stripe SDK dependency — already installed
- No `payoutMode` column or routing logic — payout routing is story 13-2, not this story
- No provider-facing UI changes — the step-card already shows "Payment Setup" for `stripe_connect`; the onboarding link opens in a new tab via `window.open()`

### Testing Requirements

**Test framework:** Vitest 4.0.18

**Stripe Connect link generation tests:**
1. `POST /stripe-link` with no existing account → creates account, returns link URL
2. `POST /stripe-link` with existing account → generates new link only (no duplicate account)
3. `POST /stripe-link` when Stripe API fails → returns 503, step stays `pending`
4. `POST /stripe-link` logs `stripe_connect.account_created` and `stripe_connect.link_generated`
5. `POST /stripe-link` transitions step `pending` → `in_progress`

**Status check tests:**
6. `GET /stripe-status` when `charges_enabled === true` → step transitions to `complete`
7. `GET /stripe-status` when `charges_enabled === false` → returns pending, no status change
8. `GET /stripe-status` with no Connect account → returns 404
9. Status check runs all-steps-complete auto-transition when completing

**Webhook tests:**
10. `account.updated` with `charges_enabled: true` → transitions step to `complete`
11. `account.updated` with `charges_enabled: false` → no change
12. `account.updated` for unknown account → 200 (no error, orphan)
13. `account.updated` TOCTOU: step already `complete` → no double-transition

**Reconciliation tests:**
14. `reconcileStripeConnectStatuses()` finds stale accounts > 4 hours
15. Reconciliation transitions enabled accounts to `complete`
16. Reconciliation skips accounts where `charges_enabled` is still false
17. `POST /reconcile/stripe-connect` returns detailed results

**Abandonment reminder tests:**
18. Providers > 24h without completion get first reminder
19. Providers > 72h get second reminder
20. Providers who already received reminders are not duplicated (metadata tracking)

### Previous Story Intelligence (12-2)

**Key learnings from story 12-2 (Admin Adjudication, Polling Reconciliation):**
- Reconciliation pattern is well-established: `ReconciliationResult` interface with `{ checked, updated, errors, details }` — reuse for Stripe Connect reconciliation
- TOCTOU guard pattern: `WHERE clause` matching expected current status on all updates — critical for concurrent webhook + polling
- All-steps-complete auto-transition: when step → `complete`, check ALL steps → transition provider to `pending_review` if all complete
- Fire-and-forget notification pattern: `.catch((err) => { console.error("[Notifications] Failed:", err); })`
- Lazy imports in notification functions to avoid circular deps: `const { db } = await import("@/db")`
- Pipeline stage `stripe_setup` already exists for providers with incomplete stripe_connect step
- Code review fix: double `.where()` on `$dynamic()` queries replaces the first condition — use `and()` to combine

**Key learnings from story 12-1 (Checkr API + Webhook):**
- Webhook event deduplication via `processedEvents` Set — reuse same pattern for Stripe Connect events
- Webhook handler pattern: look up entity by external ID, verify step status, transition, broadcast, audit
- Polling reconciliation threshold: use `lt(onboardingSteps.updatedAt, threshold)` for stale detection

### Git Intelligence Summary

| Commit | Relevance |
|---|---|
| `a19f0b3` Add provider registration links | Low — marketing links |
| `b4cc7d4` Fix Epic 10 bugs and XSS audit | Medium — confirms onboarding is stable |
| `9f1610a` Implement Epic 10 | High — onboarding pipeline base + state machine |

### Latest Technical Information

**Stripe Connect Express (Stripe SDK v20.3.0):**
- `stripe.accounts.create({ type: 'express', email, metadata })` — creates Express account
- `stripe.accountLinks.create({ account, return_url, refresh_url, type: 'account_onboarding' })` — generates hosted onboarding link (valid for ~5 minutes, regenerate as needed)
- `stripe.accounts.retrieve(accountId)` — check `charges_enabled`, `details_submitted`, `payouts_enabled`
- `stripe.accounts.createLoginLink(accountId)` — generates one-time link to Express Dashboard (for managing bank info)
- Webhook event: `account.updated` — fires when account verification status changes
- Express accounts: Stripe handles all KYC, identity verification, bank account validation, 1099-K reporting
- No SSN, bank account numbers, or tax IDs touch the platform — Stripe owns all PII

**Important:** `accountLinks.create()` URLs expire quickly (~5 minutes). Always generate a fresh link when the provider clicks "Set Up" or "Continue". Do NOT store the link URL.

### Project Structure Notes

- Stripe Connect endpoints go in `server/api/routes/onboarding.ts` — provider-facing onboarding endpoints
- Webhook handler extends existing `server/api/routes/webhooks.ts` Stripe handler (already validates Stripe signatures)
- Reconciliation follows pattern from `server/api/lib/reconciliation.ts` — same `ReconciliationResult` interface
- Admin trigger endpoints in `server/api/routes/admin-providers.ts` — matches existing `POST /reconcile/checkr`
- Notifications follow pattern from `lib/notifications/index.ts` — lazy imports, dual-channel (email + SMS)
- `providers.stripeConnectAccountId` column already exists at `db/schema/providers.ts:55`
- Audit actions already defined: `stripe_connect.account_created`, `stripe_connect.onboarding_completed`, `stripe_connect.link_generated` at `server/api/lib/audit-logger.ts:92-94`

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 3.2: Stripe Connect Express]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 3.4: Polling Fallback Jobs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Payout routing via Connect account existence]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Stripe Connect Flow diagram]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR29-FR35: Stripe Connect Express]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — FR52-FR54: Payout Transition]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-P5: Stripe link generation < 2s]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-S7: Stripe signature validation]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-SC4: Polling handles 50 pending accounts]
- [Source: `_bmad-output/planning-artifacts/prd-provider-onboarding.md` — NFR-I3: 4-hour polling threshold]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4/13: Stripe Connect Express & Automated Payouts]
- [Source: `server/api/lib/audit-logger.ts` — stripe_connect.* audit actions (lines 92-94)]
- [Source: `db/schema/providers.ts` — stripeConnectAccountId column (line 55)]
- [Source: `lib/stripe.ts` — Stripe client singleton (lines 1-25)]
- [Source: `server/api/routes/onboarding.ts` — initializeOnboardingPipeline() creates stripe_connect step (line 139)]
- [Source: `server/api/routes/admin-providers.ts` — Pipeline stages include stripe_setup (line 211)]
- [Source: `components/onboarding/step-card.tsx` — stripe_connect UI config (lines 48-52)]
- [Source: `_bmad-output/implementation-artifacts/12-2-admin-adjudication-polling-reconciliation-and-dispatch-gating.md` — Reconciliation pattern, TOCTOU, all-steps-complete]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Implemented 3 provider-facing Stripe Connect endpoints: POST /stripe-link (account creation + link generation), GET /stripe-status (charges_enabled check + step completion), GET /stripe-dashboard (Express Dashboard login link)
- Added account.updated webhook handler in webhooks.ts with TOCTOU protection and all-steps-complete auto-transition
- Added reconcileStripeConnectStatuses() with 4-hour stale threshold following Checkr reconciliation pattern
- Added checkStripeConnectAbandonment() with 24h/72h reminder thresholds and metadata-based deduplication
- Added notifyStripeConnectReminder() with dual-channel (email + SMS) notifications
- Added 2 admin reconciliation trigger endpoints: POST /reconcile/stripe-connect and POST /reconcile/stripe-reminders
- Added stripe_connect.reconciliation_run and stripe_connect.reminder_sent audit actions
- 22 unit tests covering all endpoints, webhook handler, reconciliation, and abandonment reminders
- Full test suite: 347 tests passing, 0 regressions
- No new dependencies — uses existing Stripe SDK v20.3.0, no schema migrations needed

### File List

**New files:**
- tests/unit/stripe-connect-onboarding.test.ts
- tests/unit/all-steps-complete.test.ts
- server/api/lib/all-steps-complete.ts

**Modified files:**
- server/api/routes/onboarding.ts (added POST /stripe-link, GET /stripe-status, GET /stripe-dashboard + stripe import)
- server/api/routes/webhooks.ts (added account.updated webhook handler case)
- server/api/lib/reconciliation.ts (added reconcileStripeConnectStatuses(), checkStripeConnectAbandonment(), stripe import)
- server/api/lib/audit-logger.ts (added stripe_connect.reconciliation_run and stripe_connect.reminder_sent audit actions)
- server/api/routes/admin-providers.ts (added POST /reconcile/stripe-connect and POST /reconcile/stripe-reminders endpoints)
- lib/notifications/index.ts (added notifyStripeConnectReminder() function)
