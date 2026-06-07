/**
 * Baseline adoption for `drizzle-kit migrate`.
 *
 * The migration history was squashed to a single 0000_baseline.sql representing
 * the full current schema. A FRESH database simply runs the baseline. But an
 * EXISTING database that was provisioned out-of-band via `drizzle-kit push`
 * (e.g. production before this reconciliation) already has every object, with an
 * empty migration-tracking table — so a naive `migrate` would try to re-create
 * existing objects and fail.
 *
 * This script detects that case and marks the baseline as already applied
 * (drizzle records hash = sha256(file), created_at = journal `when`), so the
 * subsequent `drizzle-kit migrate` skips the baseline and applies only future
 * migrations. Idempotent and safe to run on every boot:
 *   - history already present  → no-op
 *   - fresh DB (no schema)     → no-op (baseline applies normally)
 *   - adopted DB (schema, no history) → record baseline as applied
 */
const fs = require("fs");
const crypto = require("crypto");
const postgres = require("postgres");

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

(async () => {
  await sql.unsafe('CREATE SCHEMA IF NOT EXISTS drizzle');
  await sql.unsafe(
    'CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)'
  );

  const [{ count }] = await sql`select count(*)::int as count from drizzle."__drizzle_migrations"`;
  if (count > 0) {
    console.log("[baseline-adopt] migration history present — nothing to do");
    return;
  }

  // Empty history: is the schema already provisioned (adopted DB) or truly fresh?
  const [{ exists }] = await sql`select to_regclass('public.providers') is not null as exists`;
  if (!exists) {
    console.log("[baseline-adopt] fresh database — baseline will be applied by migrate");
    return;
  }

  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync("db/migrations/0000_baseline.sql"))
    .digest("hex");
  const when = JSON.parse(fs.readFileSync("db/migrations/meta/_journal.json", "utf8")).entries[0].when;

  await sql`insert into drizzle."__drizzle_migrations" (hash, created_at) values (${hash}, ${when})`;
  console.log("[baseline-adopt] existing schema adopted — baseline marked as applied");
})()
  .then(() => sql.end())
  .catch((err) => {
    console.error("[baseline-adopt] FAILED:", err.message);
    process.exit(1);
  });
