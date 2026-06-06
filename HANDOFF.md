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
