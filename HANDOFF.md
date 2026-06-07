# RoadSide GA — Security Remediation Handoff

_Last updated: 2026-06-06 • Branch: `fix/audit-remediation-batch1` • Source audit: [`docs/audit-2026-06.md`](docs/audit-2026-06.md)_

This doc is the single source of truth for the in-progress security/reliability remediation. It records what's shipped, the current PR/deploy state, the required operational actions, and the remaining roadmap.

---

## 1. What shipped this session

On branch `fix/audit-remediation-batch1` (open as **PR #41 → `development`**):

| Finding | What | Files | Status |
|---|---|---|---|
| **H6** | Invoice-status IDOR — added `createdById` ownership guard | `server/api/routes/invoices.ts:419` | ✅ merged in branch |
| **M1** | Invoice-send IDOR — same ownership guard | `server/api/routes/invoices.ts:387` | ✅ |
| **M5** | CSV/formula injection — `generateCSV` now prefixes leading `= + - @ \t \r` | `lib/csv.ts:11` | ✅ |
| **H7 (partial)** | Rate-limiter shared-bucket self-DoS — resolve real client IP (`cf-connecting-ip` → `x-real-ip`/`x-forwarded-for` under `TRUST_PROXY`), **fail open** instead of the global `"unknown-client"` bucket | `server/api/middleware/rate-limit.ts` | ✅ code |
| **H7 (deploy)** | Wired `TRUST_PROXY` into the app container env | `docker-compose.yml` | ✅ |

### Batch A — fail-closed guardrails + dead infra (Step 2), committed on this branch

| Finding | What | Files |
|---|---|---|
| **C1** | Removed hardcoded `admin123`; seed now requires `ADMIN_PASSWORD` env (≥12 chars, no default). Removed admin email-verification bypass. Added prod-seed safety gate (`ALLOW_PROD_SEED`) in seed + entrypoint so a stray `SEED_DB=true` can't wipe prod. | `db/seed-base.ts`, `db/seed.ts`, `db/seed-demo.ts`, `lib/auth.config.ts`, `docker-entrypoint.sh` |
| **H2/H3** | `validateEnv()` now `process.exit(1)` (was `console.warn`) on placeholder secrets in production, incl. `STRIPE_WEBHOOK_SECRET=whsec_xxx`. | `lib/env.ts` |
| **H4** | New `instrumentation.ts` `register()` hook validates env + starts cron at boot (standalone `server.js` never ran the custom server). `startCronJobs()` made idempotent. **WS deferred** — needs the HTTP `upgrade` event the standalone server owns; requires a custom-server or separate-WS-port + Traefik routing decision. | `instrumentation.ts`, `server/cron.ts` |
| **H5** | Failed migrations / schema-push / seed now `exit 1` (was "continuing"). Build sets `SKIP_ENV_VALIDATION=1`; runtime validates fail-closed. | `docker-entrypoint.sh`, `Dockerfile` |

> ⚠️ **DEPLOY ORDER:** Batch A makes the app **fail closed**. Do **NOT** deploy it until Step 1 ops are done — specifically real secrets set (else H2/H3 crash-loops the container) and `ADMIN_PASSWORD` set if `SEED_DB=true`. H5 also surfaces the existing `ic_agreement` migration drift: reconcile drizzle history vs live schema, or the now-fatal migrate will halt boot (that's the point — fix the drift).
> Still open in H4: WebSocket startup. Still open in H5: live migration-history reconciliation (needs DB access).

### Batch B — auth rate-limiting, Postgres-backed (Step 3), committed on this branch

| Finding | What | Files |
|---|---|---|
| **H1** | Web login (`/api/auth/[...nextauth]`) had zero throttling. Added durable per-email + per-IP login throttle (10 / 15 min) in the credentials `authorize()` callback; resets on success. | `lib/auth/login-throttle.ts`, `lib/auth.config.ts` |
| **H7 (remainder)** | New Postgres-backed limiter (`rate_limits` table) so auth limits survive restarts. New `rateLimitDb` middleware keys on IP **and** email (blocks if either exceeds). Swapped auth endpoints to `rateLimitAuthDb`; protected the previously-open `/verify-email` + `/verify-reset-token` (token enumeration). | `db/schema/rate-limits.ts`, `server/api/lib/rate-limiter-db.ts`, `server/api/middleware/rate-limit.ts`, `server/api/routes/auth.ts`, `lib/client-ip.ts` (shared IP resolver) |

> **Migration note:** `rate_limits` is created by `db/migrations/0030_rate_limits.sql` (idempotent `CREATE TABLE IF NOT EXISTS`) and by `drizzle-kit push` (the mechanism prod actually uses — the migration *journal* is drifted and stops at idx 19; that's the H5 reconciliation task). The DB limiter and login throttle **fail open** if the table/store is unavailable, so a missing migration degrades to "no limiting," never a broken login.
> Still open: provider-registration still uses the in-memory `rateLimitAuth` (not yet email-keyed); no per-email lockout *persistence* test (needs a live DB).

### Batch C — access control & PII (Step 4), committed on this branch

| Finding | What | Files |
|---|---|---|
| **M2** | Provider customer-search now scoped to customers the provider actually serviced (EXISTS on bookings); admins keep full search. Stops PII-database enumeration. | `server/api/routes/user-search.ts` |
| **M3** | `GET /business-settings` strips raw bank fields (account #, routing, swift, account name) for non-admins. | `server/api/routes/business-settings.ts` |
| **M4** | Admin `/customers` now selects an explicit `safeUserColumns` whitelist instead of `select({ user: users })` — no more password hashes / `taxId` / Stripe ids in the response. | `server/api/routes/admin.ts`, `server/api/lib/safe-columns.ts` |
| **L4** | Public provider reviews mask reviewer names ("Jasmine C." not full name). | `server/api/routes/reviews.ts` |
| **L5** | LIKE/ILIKE wildcards escaped in user-search + admin customer search via shared `escapeLike`. | `server/api/lib/sql-escape.ts`, `user-search.ts`, `admin.ts` |

> Pure code, no schema/deploy-order implications. Still open: `escapeLike` should also be applied to the other ~5 search endpoints the audit lists (only the two PII-bearing ones done here); audit remaining `.select({ x: <table> })` patterns for other over-fetches.

### Batch D — money-path integrity / DB invariants (Step 5), committed on this branch

| Finding | What | Files |
|---|---|---|
| **M6** | Persistent `webhook_events` table replaces the in-memory dedup Sets. Partial unique indexes enforce: one payment per Stripe session, one standard payout per booking, one clawback per original payout. `createPayoutIfEligible` tolerates the race (returns the winning row, no double Stripe transfer). | `db/schema/webhook-events.ts`, `db/schema/payments.ts`, `db/schema/provider-payouts.ts`, `server/api/routes/webhooks.ts`, `server/api/lib/payout-calculator.ts` |
| **M7** | `charge.refunded` now creates a payout clawback on full out-of-band refunds (mirrors dispute-lost); the clawback unique index prevents duplicates when refund + dispute.lost both fire. | `server/api/routes/webhooks.ts` |
| **M8** | Destination-charge refunds set `reverse_transfer` + `refund_application_fee` so the provider's share is clawed back, not absorbed by the platform. | `server/api/routes/admin-payouts.ts` |
| **M9** | Dropped the `Math.max` payout floor — service-level commission is authoritative; the provider rate overrides only when deliberately set ≠ default (7000). No effect on current data (services ≤30% cut), prevents future overpay. | `server/api/lib/payout-calculator.ts` |
| **M10** | Container `TZ=America/New_York` (+ tzdata) so pricing time-blocks / earnings windows compute in ET. | `Dockerfile`, `docker-compose.yml` |
| **L1** | Admin confirm-payment is idempotent — returns 409 if a confirmed payment already exists (no duplicate payment / double trust-tier bump). | `server/api/routes/admin.ts` |
| **L2** | Refund webhook distinguishes `partially_refunded` from `refunded` and always records the cumulative `refundAmount`. | `db/schema/payments.ts` (enum), `server/api/routes/webhooks.ts` |

> **Migration:** `db/migrations/0031_money_invariants.sql` (idempotent). Like `0028`, it uses `ALTER TYPE … ADD VALUE` for the enum, applied via `drizzle-kit push` (the journal is still drifted — H5).
> **Verify before trusting in prod:** replay a duplicate Stripe event → single payout; a full `charge.refunded` → exactly one clawback; an off-hours surcharge fires at the correct ET boundary (M10 shifts ALL local-time behavior — sanity-check other date logic).
> **Deferred:** **L7** (TOCTOU booking transitions — latent, offer-mode off, spread across 3 files); partial-refund *payout* clawback (only full refunds claw back here; admin refund path handles proportional); the duplicated M9 estimate math in `auto-dispatch*.ts`/`admin.ts` (those are display estimates, not the authoritative payout).

### Batch E — dependencies & hygiene (Step 6), committed on this branch

| Finding | What | Files |
|---|---|---|
| **M13** | `npm audit fix` (non-breaking) + bumped `next` 16.1.6 → 16.2.7. Resolved **all high-severity** advisories (Next.js request smuggling / Server Actions CSRF bypass / DoS) — prod audit down from 22 vulns (6 high) to 7 (0 high; remaining are moderate/low). | `package.json`, `package-lock.json` |
| **L3** | Geocoding proxy is `rateLimitStrict` (kept unauthenticated so guest booking still geocodes) — stops anonymous loops running up the Google Maps bill. | `server/api/routes/geocoding.ts` |
| **L6** | `/documents` now verifies the **actual** S3 object size (HEAD) instead of the client-reported `fileSize`, rejecting + deleting oversized uploads. (MIME was already enforced via zod enum + pinned PUT ContentType.) | `lib/s3.ts` (`getObjectSize`/`deleteFile`), `server/api/routes/onboarding.ts` |
| **L8** | `docker-compose.yml`: Postgres no longer published to the host (`expose` only); app bound to `127.0.0.1`. | `docker-compose.yml` |

> **Verify in CI/Docker:** the dependency bump can't be build-verified here (host is Node 18; Next needs ≥20). `tsc` + `eslint` pass; **run `npm run build` + e2e in CI (Node 20) before merging.**
> **Remaining audit items (no clean fix):** `nodemailer` SMTP-injection moderates (transitive via `@auth/core`, **no upstream fix** yet) and a `postcss` build-time XSS moderate (bundled inside `next`). Both moderate, low real-world exposure; revisit when upstream patches land.
> **L9 (ops, not code):** move live Twilio creds + `AUTH_SECRET` out of plain container env into Coolify secrets/vault and rotate if access is broad — a manual Coolify action.

**Validation:** local dockerized rebuild + per-IP correctness tests — distinct IPs get separate buckets, single IP still caps at limit, fails open with one throttled warning when unidentified, no 429 storm under load. Reusable harness left at `loadtest/part-a-correctness.sh` and `loadtest/part-b-local-ramp.js` (untracked).

**Tag:** `v1.4.2-rc.1` pushed. ⚠️ The `deploy-staging` CI job is a **stub** — there is no staging environment, so this tag deployed nowhere. (`COOLIFY_STAGING_APP_UUID` is unset.)

---

## 2. Current state / how to promote

- **Branch policy** (`.github/workflows/enforce-branch-policy.yml`): **PRs to `main` must come from `development`.** A feature/fix branch cannot PR directly to `main`.
- **Promotion path:** `fix/audit-remediation-batch1` → (PR #41) → `development` → (PR) → `main`.
- **Tags:** `v*.*.*` → prod deploy; `v*.*.*-rc.*` → staging (non-functional today). Tag a `PATCH` (`v1.4.2`) **on the `development → main` merge commit**, never on a feature branch.
- **Pre-deploy checklist** (`CLAUDE.md`): `npm test`, `npm run build`, `eslint`, `tsc --noEmit` all clean, no uncommitted changes.
- **Test caveat:** `vitest` currently fails to launch in the local sandbox (`ERR_REQUIRE_ESM`, vite/vitest version mismatch). `tsc` + `eslint` pass. Run the unit suite in CI or fix the version mismatch.

---

## 3. ⚙️ DO TODAY — operational actions (Coolify, no code/PR)

These stop active exposure immediately and are the owner's to perform:

1. **C1** — Rotate `admin@roadsidega.com` + `ops@roadsidega.com` passwords in the live DB (the seed default `admin123` is live).
2. **H2/H3** — Set real `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, Google OAuth in Coolify and redeploy. The webhook secret is currently the public placeholder `whsec_xxx` → **webhooks are forgeable**.
3. **H7** — Set **`TRUST_PROXY=true`** in Coolify. Until set, the shipped rate-limiter fix **fails open (no limiting)** because the app only sees Traefik's IP. Also confirm Traefik strips/overwrites client-supplied `X-Forwarded-For`.
4. **M11** — Rotate the Postgres password off `dealer_pass` (DB shares the Coolify bridge network with other tenants).
5. **M12** — Issue two distinct Google Maps keys (referrer-restricted browser key, IP/API-restricted server key); rotate the leaked shared one.
6. Confirm **Coolify Postgres backups** exist and test a restore.

---

## 3a. ✅ Migrations reconciled — cutover via `DB_ADOPT_BASELINE`

The earlier journal drift is **resolved** (#46): history is squashed to a single
`0000_baseline.sql` (+ `0001_service_estimate_ranges` from #42), verified
end-to-end on a real Postgres. A fresh DB just runs `drizzle-kit migrate`. An
existing (push-provisioned) prod DB is adopted by the entrypoint when
`DB_ADOPT_BASELINE=true`: it `push`es the full schema, then `db/baseline-adopt.cjs`
marks **all** current migrations applied so the follow-up `migrate` is a clean
no-op. (A pre-release sweep caught — and we fixed — that the adopt step must mark
*every* journal entry, not just the baseline, or `migrate` would replay `0001`'s
`ADD COLUMN` and crash the container.)

**Before the cutover:** follow `docs/prod-cutover-runbook.md` and run
`npm run db:preflight` (catches data that would fail the new unique indexes).
**After deploying, verify:**
```sql
\d rate_limits        \d webhook_events
select indexname from pg_indexes where indexname like 'uniq_payout%' or indexname='uniq_payments_stripe_session';
select 'partially_refunded'::payment_status;  -- must not error
```
**Caveat:** adoption marks `0001` applied, so its estimate-range *backfill* does
not run on pre-existing prod service rows (they keep NULL ranges until updated);
the new mechanic services (#42) come via seed, not migration, so introduce them
to prod separately if needed.

---

## 3b. Independent review (post-implementation)

Three parallel adversarial reviews ran over the whole branch. Real bugs found **and fixed** in commits `c4def24` + the follow-up:
- Login throttle counted *successful* logins toward the per-IP limit (shared-IP self-lockout) → now counts failures only.
- `dispute.lost` clawback insert not tolerant of the new unique index → wrapped.
- Admin refund clawback inside a transaction could abort *after* the Stripe refund → pre-check added.
- **Destination-charge refund double-debited the provider** (M8 `reverse_transfer` + clawback record) → clawback now skipped for destination charges.
- Payout could be missed on a confirm-retry → `createPayoutIfEligible` now runs on the already-confirmed path.
- Transient S3 error wrongly rejected valid uploads → distinguishes 404 from transient.

Confirmed **safe** (false alarms): referral payouts (`payoutType:'referral'`, not covered by the indexes); each checkout uses a fresh `stripeSessionId`; the M2 `EXISTS` correlated subquery generates correct SQL; env fatal-exit can't fire at build; Hono body-cache lets the email-keying middleware read the body without breaking handlers.

Still-open judgement calls (need owner confirmation, not bugs): **M9** payout semantics — provider rate is now an *exact* override, not a floor (matches the audit's intent; confirm it's what you want for negotiated providers). **M2 partial out-of-band refund** doesn't proportionally claw back the payout (only full refunds do; admin refund path handles proportional). Per-email login lockout is a deliberate (standard) trade-off that allows targeted-account lockout DoS.

---

## 4. Remaining roadmap (see plan + audit for detail)

Batches land on `development` via PR, by severity/area:

- **Step 2 — Fail-closed guardrails + dead infra (CRITICAL/HIGH):**
  - **C1** remove hardcoded seed passwords; require `ADMIN_PASSWORD`; remove admin email-verification bypass (`lib/auth.config.ts:33`).
  - **H2/H3** `lib/env.ts` → `process.exit(1)` on placeholder secrets in prod; hard-fail on placeholder webhook secret.
  - **H4** cron + WebSocket never start in prod (`docker-entrypoint.sh:64` runs `server.js`, not the custom server) — fix entrypoint or add `instrumentation.ts`.
  - **H5** migrations fail silently (`docker-entrypoint.sh:53-58` continues on failure) — make fatal; reconcile `ic_agreement` enum drift breaking onboarding.
- **Step 3 — Auth rate-limiting (HIGH, Postgres-backed):** **H1** web login (`/api/auth/[...nextauth]`) has zero limiting/lockout — add `middleware.ts` + per-email lockout via a new `login_attempts` table; protect `/verify-email` + `/verify-reset-token`; **H7 remainder** key auth limits on email+IP and persist to Postgres.
- **Step 4 — Access control / PII:** M2 (user-search enumeration), M3 (bank fields exposed), M4 (admin over-fetches password hashes), L4, L5.
- **Step 5 — Money-path DB invariants:** M6 (persistent webhook idempotency + unique constraints), M7, M8, M9, M10 (UTC→ET), L1, L2, L7.
- **Step 6 — Infra hygiene:** M13 (dep CVEs), L3, L6, L8, L9; boot-time assertions + Sentry/healthcheck alerting; backups/DR.

**Decision on record:** durable rate-limit/lockout state uses **Postgres** (existing DB), **not Redis** — deployment is single-process; revisit Redis only when scaling horizontally.

Full detail: `docs/audit-2026-06.md` (all 30 findings + blind spots) and the approved remediation plan.
