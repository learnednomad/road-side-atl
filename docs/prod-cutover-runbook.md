# Production cutover runbook — v1.4.2 (security remediation + migration baseline)

Order of operations to promote `development → main` and deploy to production. The
migration history was squashed to a single baseline; the live DB adopts it via a
**one-time** `DB_ADOPT_BASELINE=true` deploy. Do the steps in order.

## 0. Prerequisites (Coolify env on app 48) — must be true before deploying
- [ ] Real secrets set: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, Google OAuth *(else `lib/env.ts` fails closed → crash-loop)*
- [ ] `TRUST_PROXY=true` *(else rate limiting / login lockout are inert)*
- [ ] `ADMIN_PASSWORD` set (≥12 chars); `SEED_DB=false`
- [ ] Postgres password rotated off `dealer_pass`; admin creds rotated off `admin123`

## 1. Pre-flight (read-only) — catch data that would break the cutover
The cutover's `push` creates partial unique indexes; pre-existing duplicates would
fail it mid-deploy. Run against the **prod** DB and resolve any blockers first:

```bash
DATABASE_URL='postgres://…prod…' npm run db:preflight
```
- Exit 0 → safe to proceed.
- Exit 1 → it prints the offending rows + remediation (e.g. duplicate standard
  payouts from the dead-cron era). Dedupe (keep the `paid`/earliest, void the
  rest after review), then re-run until clean.

## 2. Back up the database
Take a Coolify backup (or `pg_dump`) and confirm it completed. The cutover runs
`push --force`, which can also drop objects present in the DB but absent from the
schema — a backup is your safety net.

## 3. Promote
1. Merge PR #43 (`development → main`).
2. Tag the merge commit: `git tag -a v1.4.2 -m "Release 1.4.2: security remediation + migration baseline" && git push origin v1.4.2` → triggers the prod deploy.

## 4. One-time baseline adoption
- Set **`DB_ADOPT_BASELINE=true`** in Coolify for this single deploy.
- The entrypoint then: `push` (adds `rate_limits`, `webhook_events`, the 3
  partial unique indexes, the `partially_refunded` enum, and any other missing
  objects) → marks the baseline applied → `migrate` (no-op for the baseline).
- It is **fail-closed**: if push or adoption fails, the container won't start.

## 5. Verify post-deploy
```sql
\d rate_limits        \d webhook_events
select indexname from pg_indexes
  where indexname in ('uniq_payments_stripe_session','uniq_payout_standard_booking','uniq_payout_clawback_original');
select 'partially_refunded'::payment_status;   -- must not error
```
- App health: `GET /api/health` 200; admin pipeline view loads; a test login.
- Money smoke test: a duplicate Stripe event → exactly one payout; a full
  `charge.refunded` → exactly one clawback; an off-hours surcharge fires at the
  correct ET boundary (TZ=America/New_York).

## 6. Clean up
- **Remove `DB_ADOPT_BASELINE`** from Coolify. Future deploys use plain `migrate`
  (the baseline is already recorded; only newer migrations apply).

## Rollback
- App-only issue → redeploy the previous image tag.
- Schema issue → restore the step-2 backup. (The baseline + adoption are additive;
  the new objects are unused by old code, so a forward-fix is usually preferable.)
