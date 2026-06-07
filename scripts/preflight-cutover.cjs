#!/usr/bin/env node
/**
 * Pre-flight checks for the production migration cutover (DB_ADOPT_BASELINE).
 *
 * The cutover runs `drizzle-kit push` against the live DB, which CREATES the new
 * partial unique indexes. If existing prod data violates them, the index
 * creation (and therefore the whole deploy) fails. This script is READ-ONLY and
 * detects those violations ahead of time so they can be fixed in a calm window
 * rather than discovered mid-deploy.
 *
 * Usage (against the prod DB, e.g. via a Coolify shell or an SSH tunnel):
 *   DATABASE_URL=postgres://... node scripts/preflight-cutover.cjs
 *   # or: npm run db:preflight
 *
 * Exit code 0 = safe to cut over. Non-zero = blockers found (see output).
 */
const postgres = require("postgres");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
let blockers = 0;
let warnings = 0;

async function tableExists(name) {
  const [{ exists }] = await sql`select to_regclass(${"public." + name}) is not null as exists`;
  return exists;
}

/**
 * Run a "find duplicates" query that would violate a unique index. Reports and
 * counts a blocker if any rows come back.
 */
async function checkUnique(label, indexName, rows, remediation) {
  if (rows.length === 0) {
    console.log(`  ✅ ${label}: no violations`);
    return;
  }
  blockers++;
  console.error(`  ❌ ${label}: ${rows.length} value(s) would violate ${indexName}`);
  for (const r of rows.slice(0, 10)) {
    console.error(`       ${JSON.stringify(r)}`);
  }
  if (rows.length > 10) console.error(`       … and ${rows.length - 10} more`);
  console.error(`     → ${remediation}`);
}

(async () => {
  console.log("── Pre-flight: production migration cutover ──\n");

  // ── Adoption state ───────────────────────────────────────────
  const providers = await tableExists("providers");
  let history = 0;
  try {
    const [{ c }] = await sql`select count(*)::int c from drizzle."__drizzle_migrations"`;
    history = c;
  } catch { /* migration-tracking table not present yet */ }
  console.log("Adoption state:");
  console.log(`  providers table present : ${providers}`);
  console.log(`  migration records       : ${history}`);
  if (providers && history === 0) {
    console.log("  → existing DB with no migration history: DB_ADOPT_BASELINE=true cutover applies.\n");
  } else if (!providers) {
    console.log("  → fresh DB: a normal migrate builds the baseline (no cutover flag needed).\n");
  } else {
    console.log("  → already on the migration system: a normal migrate applies pending migrations.\n");
  }

  // ── Unique-index violation checks (the cutover's hard failures) ──
  console.log("Unique-index pre-checks (must be clean before push creates them):");

  if (await tableExists("payments")) {
    const dupSession = await sql`
      select "stripeSessionId" as value, count(*)::int as count
      from payments where "stripeSessionId" is not null
      group by 1 having count(*) > 1 order by count desc`;
    await checkUnique(
      "payments.stripeSessionId", "uniq_payments_stripe_session", dupSession,
      "Multiple payment rows share a Stripe session. Keep the confirmed/most-recent row; remove or re-key the duplicates."
    );
  } else { warnings++; console.log("  ⚠️  payments table absent — skipped"); }

  if (await tableExists("provider_payouts")) {
    const dupStandard = await sql`
      select "bookingId" as value, count(*)::int as count
      from provider_payouts where "payoutType" = 'standard'
      group by 1 having count(*) > 1 order by count desc`;
    await checkUnique(
      "provider_payouts standard per booking", "uniq_payout_standard_booking", dupStandard,
      "More than one standard payout per booking (likely dead-cron double-creates). Keep the 'paid' (or earliest) one; void/delete the rest after review."
    );

    const dupClawback = await sql`
      select "originalPayoutId" as value, count(*)::int as count
      from provider_payouts
      where "payoutType" = 'clawback' and "originalPayoutId" is not null
      group by 1 having count(*) > 1 order by count desc`;
    await checkUnique(
      "provider_payouts clawback per original", "uniq_payout_clawback_original", dupClawback,
      "More than one clawback for the same original payout. Keep one; remove the duplicates."
    );
  } else { warnings++; console.log("  ⚠️  provider_payouts table absent — skipped"); }

  // ── Informational: what the cutover will add ─────────────────
  console.log("\nObjects the cutover (push) will add if missing:");
  for (const t of ["rate_limits", "webhook_events"]) {
    console.log(`  ${(await tableExists(t)) ? "present" : "will create"}: ${t}`);
  }

  console.log("");
  if (blockers > 0) {
    console.error(`❌ ${blockers} blocker(s) found — resolve them, then re-run this check before the cutover.`);
    process.exit(1);
  }
  console.log(`✅ Pre-flight passed${warnings ? ` (${warnings} warning(s))` : ""} — safe to deploy with DB_ADOPT_BASELINE=true.`);
})()
  .then(() => sql.end())
  .catch((err) => {
    console.error("Pre-flight error:", err.message);
    process.exit(2);
  });
