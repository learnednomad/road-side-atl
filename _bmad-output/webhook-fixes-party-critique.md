# Webhook Fixes — BMAD Party-Mode Critique & Decision Record

**Facilitator:** BMad Master
**Repo:** `/root/road-side-atl` (Next.js + Hono + Drizzle/Postgres roadside marketplace; money in cents, commission in basis points)
**Scope:** Three confirmed LIVE webhook bugs (issues #137, #138, + the fail-closed dispatch lock).
**Date:** 2026-06-21
**Verdict (all five personas):** approve-with-changes → **reconciled into one implementation-ready spec below.**

---

## 0. Ground truth (verified against the code, not the spec's stale line numbers)

The spec's line numbers are off by ~100+. Real anchors confirmed by reading the files:

| Thing | File | Real anchor |
|---|---|---|
| invoice.paid handler | `server/api/lib/webhook-handlers/invoice-paid.ts` | outer `try` wraps the whole `db.transaction`; 3 returns: `!accountId\|\|!amount` (handler scope), `!acct` (in-tx), existing-payment guard (in-tx); unused `logger` import after fix |
| subscription handlers | `server/api/lib/webhook-handlers/subscription.ts` | `handleSubscriptionUpsert` = check-then-act (`findFirst` then insert/update) + 4 un-keyed `triggerNovu`; `handleSubscriptionDeleted` = single update + 1 `triggerNovu`; unused `logger` after fix |
| Stripe dispatch | `server/api/routes/webhooks.ts` | default case `:961`, `await handler(event)` `:967`, `markEventProcessed(... unhandled?"skipped":"processed")` `:975` — **no enclosing try/catch → already fail-closed** |
| Checkr handler | `server/api/routes/webhooks.ts` | `markEventProcessed(event.id,"checkr")` **BEFORE** processing at `:1019`; `report.completed` block `:1021–1127`; no-matching-step early `return c.json({ok:true},200)` `:1041–1043`; metadata backfill `:1051–1057`; guarded status transition `:1059–1072` (optimistic `eq(onboardingSteps.status, step.status)` `:1071`); audit `:1074`; broadcasts `:1093/:1110`; `notifyBackgroundCheckResult(...).catch` `:1103`; awaited `checkAllStepsCompleteAndTransition` `:1122`; final `return` `:1129` |
| `markEventProcessed` | `server/api/routes/webhooks.ts:44–58` | swallows its OWN insert failure (best-effort), `insert(webhookEvents).values(...).onConflictDoNothing()`, supports `status: "processed"\|"skipped"\|"failed"` |
| `isUniqueViolation` | `server/api/routes/webhooks.ts:25` | `code === "23505"`; core switch re-throws non-unique at `:311` and `:558` |
| **`memberships.stripeSubscriptionId`** | `db/schema/memberships.ts:35` | **HAS `.unique()`** ✅ |
| **`b2bCreditTransactions.invoiceId`** | `db/schema/b2b-credit.ts:25` | **NO unique constraint** — plain `text("invoiceId")` ❌ |
| `checkAllStepsCompleteAndTransition` | `server/api/lib/all-steps-complete.ts` | optimistic `update(providers).set(pending_review).where(status='onboarding').returning()`; side-effects gated on `result.length>0`; migrating-branch clears `migrationBypassExpiresAt` once → **provably idempotent** ✅ |
| Existing unhandled test | `tests/unit/stripe-webhooks.test.ts:769–777` | fires `customer.subscription.created` — **a REGISTERED event**, passes only because `{id:"sub_1"}` has no `metadata.userId` (early-return) |
| Test harness `@/db` mock | `tests/unit/stripe-webhooks.test.ts:7–25` | NO `transaction`, NO `query.memberships`/`onboardingSteps`/`providers`, NO novu/broadcast/all-steps mocks |

---

## 1. Persona concerns (summary)

### Winston 🏗️ (Architect)
1. FIX 1 sound for invoice-paid (atomic tx + FOR UPDATE + in-tx guard) but **subscription.ts is check-then-act with no tx/lock** → fail-closed only self-heals if `stripeSubscriptionId` is UNIQUE (spec didn't mention it).
2. FIX 2 side-effect-vs-dedup ordering is half-right: marking "before the final return" still leaves audit/broadcasts/`notifyBackgroundCheckResult`/`checkAllSteps` BEFORE the mark → every failed retry re-fires all of them; `notifyBackgroundCheckResult` carries no stable transactionId.
3. `checkAllStepsCompleteAndTransition` idempotency is **asserted, not proven**.
4. Blanket fail-closed has no poison-event escape → Stripe retries ~3 days then **auto-disables the whole endpoint** (kills ALL webhook types).
5. `markEventProcessed` swallows its own insert failure → mark-after still leaves a window where state applied but dedup not durably recorded.
6. Money-integrity edge: `if(!acct) return` silently drops a paid B2B invoice pointing at a missing account — same swallow class one layer deeper.
7. Test harness can't exercise the new paths (no `transaction`, no `memberships.findFirst`, no novu/registry mocks).

### Amelia 💻 (Dev)
1. Spec under-counts invoice-paid returns: **three** (one handler-scope, two in-tx). Edit is just delete `try`/`catch`, de-indent.
2. Removing the catch leaves `logger` **unused in both files** → lint/tsc red (CLAUDE.md requires 0 lint + clean tsc).
3. Fail-closed **amplifies a Novu double-fire**: the 4 `void triggerNovu` calls in subscription.ts have **no transactionId** → retries spam the customer Inbox (violates CLAUDE.md "always pass a stable transactionId").
4. FIX 2 has **three** return sites, not two; cleanest placement = one mark immediately before the final return (covers report.completed-success AND ignored non-report.completed types); no-matching-step keeps its own unmarked return.
5. Tx wrapping must NOT pull broadcasts/notify inside (a Novu/socket hiccup must not roll back a committed transition); but they DO re-fire on redelivery (gated on `provider?.userId`, not on row-changed) — acceptable for fire-and-forget, call it out.
6. Harness gaps (transaction/memberships/`.for('update')`).
7. The unhandled test uses a registered type → must switch to a genuinely-unregistered type.
8. FIX 3 already true; deliverable = comment + a test asserting throw→500 AND `insert(webhookEvents)` NOT called.

### Quinn 🧪 (QA)
1. Harness **cannot run** these tests as-is (no `transaction`, `.for()`, `.limit()`, `query.memberships/onboardingSteps/providers`).
2. "Dedup row not written" **cannot** use blanket `expect(db.insert).not.toHaveBeenCalled()` — invoice-paid also inserts `b2bCreditTransactions`; must discriminate by the **table object** passed as first arg → schema mock needs `b2bAccounts`/`b2bCreditTransactions`/`memberships` + `webhookEvents.status/eventType`.
3. **Unique-violation parity underspecified**: "remove the try/catch" but "matches the core switch which re-throws non-unique" — those core sites SWALLOW 23505. Blanket removal lets a benign duplicate 23505 propagate → 500 → infinite retry. Must be a **narrow catch that re-throws only non-unique**.
4. Redelivery sim is decoupled from the dedup-write spy — must also drive `mockWebhookEventsFindFirst → undefined` on the 2nd delivery, else the test passes vacuously.
5. Checkr needs BOTH the "no-matching-step unmarked" and "mutation-throws unmarked" cases (different code paths); `checkAllSteps` redelivery-safety must be tested.
6. Default dispatch fail-closed is correct but **fragile + untested** — needs a throwing registered handler asserting 500 + no dedup insert.
7. Registry/novu/broadcast/notifications/all-steps not mocked → tests run real code or fail import; DB mock must be the SOLE controllable throw source.

### John (Product Manager)
1. Both are P0 money-integrity defects mapped to explicit acceptance criteria ("no paid invoice uncredited", "no provider stuck").
2. **Biggest user-facing risk = Stripe endpoint auto-disable from a poison event** → all Stripe webhooks stop (catastrophic). Needs an escape valve + alerting.
3. **FIX 2 spec contradiction (load-bearing):** no-matching-step returns 200; Checkr treats 200 as delivered and **won't retry** — leaving it unmarked recovers nothing. Must return a **retryable non-2xx (503)** AND stay unmarked.
4. Existing test at :769 will break (it fires a now-handled event); harness must be fixed and the test switched to a truly-unregistered type.
5. Silent-drop edge `!acct` — retry won't fix a missing account, so 500 is wrong, but silence violates the acceptance criterion → needs **ops alert for manual reconciliation**.
6. Observability gap: bare `throw` loses the structured "which invoice/sub failed" context → add money-integrity alert (reuse Slack ops-alerts #51).

### Bob (Scrum Master)
1. **File collision (highest):** `webhooks.ts` is touched by FIX 2 AND FIX 3; `stripe-webhooks.test.ts` by FIX 1 AND (potentially) FIX 2/3 → one owner per file.
2. Regression hidden by the bug: removing the subscription catch makes the :769 test 500 → must travel with FIX 1.
3. Harness completion is **in-scope, not optional**.
4. Stale line numbers — **anchor on symbols**.
5. Mark must sit AFTER `checkAllSteps`, not just after the status update.
6. **Scope-creep trap:** "make intent explicit" must NOT tempt anyone to wrap the switch in try/catch / add `app.onError` — that would RE-INTRODUCE the bug. Comment only, zero behavioral code.
7. Tx boundary = exactly the two `db.update` calls; broadcasts/notify/`checkAllSteps` stay outside.

---

## 2. Disagreements & explicit resolutions

### D1 — subscription.ts concurrency: narrow-catch vs onConflictDoUpdate
- **Tension:** Winston wants `onConflictDoUpdate` keyed on a unique `stripeSubscriptionId`; Amelia/Bob/John say "remove try/catch, keep check-then-act."
- **Ground truth:** `stripeSubscriptionId` **already has `.unique()`**. Check-then-act would self-heal via 23505→retry, but that produces avoidable 500s/retries on a normal concurrent redelivery.
- **RESOLUTION (adopt Winston):** Replace the `findFirst` + conditional insert/update with a single **`db.insert(memberships).values(values).onConflictDoUpdate({ target: memberships.stripeSubscriptionId, set: {...} })`**. Eliminates the race with zero new migration (constraint exists). Any OTHER db error propagates (fail-closed). No narrow catch needed here.

### D2 — invoice-paid: "remove the try/catch" vs "re-throw only non-unique"
- **Tension:** Spec/Amelia/Bob say remove the outer catch; Quinn warns a benign 23505 must not become an infinite 500.
- **Ground truth:** `b2bCreditTransactions.invoiceId` has **no unique constraint today**, so no 23505 can fire there *yet*. But the in-tx existing-payment guard + FOR UPDATE lock only serialize **same-account** redeliveries.
- **RESOLUTION (merge Quinn + Winston):**
  1. Add a migration: **`CREATE UNIQUE INDEX uniq_b2b_credit_payment_invoice ON b2b_credit_transactions ("invoiceId") WHERE type='payment'`** (defense-in-depth against cross-path/lock-bypass double-credit).
  2. Do NOT remove the catch to nothing — **replace the swallow-all outer catch with a narrow outer catch around the `db.transaction(...)` that re-throws everything except 23505** (mirrors core switch :311/:558). A benign duplicate → tx already rolled back (no partial credit) → `catch` swallows 23505 → 200. Every other (unexpected) error propagates → 500 → retry. The catch is on the OUTER `db.transaction` call, not mid-tx (a statement error aborts the PG tx; you cannot continue inside it).
  - Net: this is the precise reconciliation of "fail-closed on unexpected" (#137) with "benign duplicate is a no-op" (Quinn T5).

### D3 — Checkr dedup placement: inside the tx (Winston) vs at the very end after checkAllSteps (Amelia/Bob/John)
- **Tension:** Winston wants the dedup row written INSIDE the same tx as the mutations; Amelia/Bob/John want it at the very end, after `checkAllStepsCompleteAndTransition`.
- **Analysis:** If dedup commits inside the tx but `checkAllSteps` (which runs after, outside the tx) throws → 500 → retry → `isEventProcessed=true` → short-circuit → **`checkAllSteps` never re-runs → provider stuck at the all-steps transition.** That re-introduces the exact #138 class one layer up.
- **RESOLUTION (adopt Amelia/Bob/John on placement; adopt Winston's idempotency principle):** `markEventProcessed` goes at the **very end, after `checkAllStepsCompleteAndTransition` succeeds**, immediately before the final `return`. The dedup row is written ONLY when the entire pipeline (tx + audit + side-effects + all-steps transition) succeeded. Winston's deeper point — every re-runnable side-effect must be individually idempotent — is **accepted** and is exactly why we (a) keep the optimistic guard, (b) add stable transactionIds, (c) rely on `checkAllSteps`'s `result.length>0` gating.

### D4 — no-matching-step branch: 200-unmarked (orig spec) vs retryable 503-unmarked (John)
- **Tension:** Original spec says leave it unmarked at 200 "so a create-race can be retried"; John proves 200 = Checkr considers it delivered and won't retry.
- **RESOLUTION (adopt John):** Change that branch to **`return c.json({ ok: false }, 503)` and stay UNMARKED**, so a brief candidate-create race actually triggers a Checkr redelivery (Checkr's retry budget is finite, so a genuinely-foreign candidate won't loop forever). Add a **warn-level log/ops note** so a persistently-unmatched candidate is observable.

### D5 — Poison-event escape hatch: full dead-letter (Winston/John) vs scope discipline (Bob)
- **Tension:** Winston/John want a bounded-retry/dead-letter terminal `failed` state to prevent Stripe endpoint auto-disable; Bob wants three surgical, revertable commits with no scope balloon.
- **Analysis:** A true "mark `failed` after N attempts" needs an **attempt-counter column on `webhook_events`** (today `markEventProcessed` only writes on success; there is no counter). That is a schema + dispatch-logic change beyond the three fixes.
- **RESOLUTION (split MUST vs FAST-FOLLOW):**
  - **MUST (this PR):** On every extension-handler throw, emit a **money-integrity ops alert (reuse Slack ops-alerts #51)** before the error bubbles, so a poison loop / uncredited invoice / unactivated membership is human-visible within the same delivery — not at retry-exhaustion. This is cheap and addresses John's "invisible until a customer complains."
  - **FAST-FOLLOW (separate tracked issue, NOT this PR):** bounded-retry / dead-letter `failed` terminal state with an attempt-counter column + queryable manual-replay. Documented so it isn't lost; deferred to respect scope discipline (and because it needs a schema migration + careful design).

### D6 — invoice-paid `!acct`: silent vs alert
- **RESOLUTION (Winston + John):** Distinguish `!accountId || !amount` (not a B2B invoice → stays a **silent** no-op) from `!acct` (invoice DID carry `b2bAccountId` but the account row is missing → **emit a loud ops/audit alert**, still no-op-return because a retry can't conjure a missing account). Same spirit for any subscription with `userId`/`planId` metadata that fails to resolve.

### D7 — Checkr side-effects in vs out of the tx
- **RESOLUTION (unanimous once stated):** tx = **exactly the two `db.update` calls** (metadata backfill + guarded status transition). Audit log, both broadcasts, `notifyBackgroundCheckResult(...).catch(...)`, and `checkAllStepsCompleteAndTransition` stay **OUTSIDE** the tx (a Novu/socket hiccup must never roll back a committed status transition). They run after commit and before the final `markEventProcessed`.

### D8 — checkAllSteps "redelivery-safe": assumed vs proven
- **RESOLUTION:** **PROVEN by inspection** (see ground-truth table): optimistic `.where(status='onboarding').returning()` → 0 rows on re-run after a prior transition; broadcast/notify gated on `result.length>0`; migrating-branch clears the bypass flag exactly once. No code change to `all-steps-complete.ts`; add a redelivery-safety test (Quinn T5 below) to lock it.

### D9 — File ownership (Bob)
- **RESOLUTION (adopt Bob's partition):**
  - **Implementer A:** `server/api/lib/webhook-handlers/invoice-paid.ts`, `subscription.ts`, the new b2b-credit unique-index **migration**, and `tests/unit/stripe-webhooks.test.ts` (harness extension + FIX 1 tests + FIX 3 dispatch tests + the :769 fix).
  - **Implementer B:** ALL of `server/api/routes/webhooks.ts` (FIX 2 Checkr + the FIX 3 one-line comment) and a NEW `tests/unit/checkr-webhooks.test.ts`.
  - No file written by both. Commit order: (1) FIX 1 + migration + stripe tests, (2) FIX 2 + checkr tests, (3) FIX 3 comment.

---

## 3. Reconciled, implementation-ready fix-spec

### FIX 1 — Stripe extension handlers fail-CLOSED on unexpected errors (#137)
**Files:** `invoice-paid.ts`, `subscription.ts`, + new migration.

- **invoice-paid.ts:** Replace the swallow-all `try { db.transaction(...) } catch { logger.error }` with a **narrow outer catch** around `await db.transaction(...)` that does `catch (err) { if (!isUniqueViolation(err)) throw err; }` (import/define `isUniqueViolation`). Keep ALL THREE returns unchanged (`!accountId||!amount` handler-scope; `!acct` in-tx; existing-payment guard in-tx). On `!acct`, **add a money-integrity ops alert** (#51) before the no-op return. Remove the now-unused `logger` import only if no longer referenced.
- **subscription.ts:** In `handleSubscriptionUpsert`, remove the `try/catch` and replace check-then-act with `db.insert(memberships).values(values).onConflictDoUpdate({ target: memberships.stripeSubscriptionId, set: {...the mutable fields...} })`. Keep `!userId||!planId` early return. In `handleSubscriptionDeleted`, remove the `try/catch` (single update propagates errors), keep the `if(userId)` guard. Keep all `triggerNovu` calls **`void` fire-and-forget** and add a **stable transactionId**: `${sub.id}:${values.status}` (upsert), `${sub.id}:canceled` (delete). Remove unused `logger` import.
- **Migration:** `CREATE UNIQUE INDEX uniq_b2b_credit_payment_invoice ON b2b_credit_transactions ("invoiceId") WHERE type='payment'`.
- **Net effect:** Unexpected DB errors throw → dispatch throws → 500 → Stripe retries → dedup row not yet written → reprocess; idempotency guaranteed by in-tx guard + unique index (invoice) / onConflictDoUpdate (membership); benign 23505 → 200; notifications don't double-post.

### FIX 2 — Checkr handler: mark processed AFTER applying, idempotently (#138)
**File:** `server/api/routes/webhooks.ts` (Checkr handler).

- **Remove** `markEventProcessed(event.id,"checkr")` from before the `report.completed` block (`:1019`).
- Wrap **exactly** the metadata-backfill update + the guarded status-transition update in one `await db.transaction(async (tx) => {...})`, using `tx` for both. **Keep** the optimistic guard `eq(onboardingSteps.status, step.status)`.
- Leave audit, both broadcasts, `notifyBackgroundCheckResult(...).catch(...)`, and `checkAllStepsCompleteAndTransition(...)` OUTSIDE the tx. Give `notifyBackgroundCheckResult` a stable **transactionId `${reportId}:bg-result`** (thread the param; if `@/lib/notifications` doesn't accept one, add it).
- Add **one** `await markEventProcessed(event.id,"checkr", "report.completed", "processed")` immediately before the final `return c.json({ ok: true }, 200)` — AFTER `checkAllStepsCompleteAndTransition`. Covers report.completed-success AND ignored non-report.completed Checkr types.
- Change the **no-matching-step** branch to `return c.json({ ok: false }, 503)` (retryable) and stay UNMARKED; add a warn-level log.
- `checkAllStepsCompleteAndTransition` unchanged (proven idempotent).

### FIX 3 — Make extension dispatch explicitly fail-closed (lock with tests)
**File:** `server/api/routes/webhooks.ts` (default case).

- **Comment only**, zero behavioral change, at the default case: document that a thrown handler intentionally bubbles to a Hono 500 **before** `markEventProcessed` at `:975`, so the dedup row is never written on failure and Stripe retries. **Do NOT** add try/catch around the switch/dispatch or `app.onError` (would re-introduce the bug). Verify by inspection that no enclosing catcher exists.
- Add the ops-alert hook (D5 MUST): on a handler throw, emit the money-integrity alert before re-raising (can live in the same default-case path or in each handler; place it where it observes the throw without converting it to a 200).

---

## 4. Test harness extensions (shared prerequisite)

Extend `vi.mock("@/db")`:
- `transaction: vi.fn(async (cb) => cb(txMock))` where a throw inside `cb` **rejects** (never swallowed); `txMock` exposes chainable `select().from().where().for()` / `.limit()`, `insert().values()`, `update().set().where()`.
- `query.memberships.findFirst`, `query.onboardingSteps.findFirst`, `query.providers.findFirst` (+ `findMany` for all-steps).
- `select` results **queueable per call** (`mockResolvedValueOnce`) so a test can sequence `[acct]` then `[]` (no existing payment) vs `[acct]` then `[{id}]` (existing).

Extend `vi.mock("@/db/schema")`: add `b2bAccounts`, `b2bCreditTransactions`, `memberships`, `onboardingSteps`, `providers` table objects; add `status` + `eventType` keys to `webhookEvents`. Canonical "dedup row NOT written" assertion = table-identity based:
`const tables = mockDbInsert.mock.calls.map(c => c[0]); expect(tables).not.toContain(webhookEvents);` (and `toContain` on success).

Add module mocks so the DB mock is the SOLE controllable throw source: the extension registry, `@/lib/notifications/novu` (`triggerNovu`/`WF`/`custSub`), `@/server/websocket/broadcast`, `@/lib/notifications`, `../lib/all-steps-complete`.

Fix the existing test at `:769`: switch `customer.subscription.created` → a genuinely-unregistered type (e.g. `customer.source.created`) to actually exercise unhandled→`skipped`.

---

## 5. Acceptance gates

- A paid-but-uncredited invoice (`!acct`) or unexpected-throw produces a human-visible ops alert within the same delivery (not at retry-exhaustion).
- No notification double-post on Stripe/Checkr redelivery (stable transactionIds).
- A thrown handler → HTTP 500 AND no `webhookEvents` insert (Stripe/Checkr will retry).
- Benign duplicate (23505 / onConflict) → 200, no double-credit, no duplicate membership.
- Checkr provider never stuck: dedup marks only after the full pipeline incl. `checkAllSteps`.
- `npm test` green, `npm run build` ok, 0 lint errors, clean `tsc --noEmit` (remove dead `logger` imports). Tag per CLAUDE.md before deploy.

---

## 6. Fast-follow (out of scope for this PR, tracked separately)
Bounded-retry / dead-letter terminal `failed` state for poison Stripe/Checkr events (needs an attempt-counter column on `webhook_events` + queryable manual replay) to prevent endpoint auto-disable from a permanently-unprocessable event. This PR delivers the observability (ops alert) that makes such loops visible; the terminal state is the follow-up.
