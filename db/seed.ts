/**
 * Seed orchestrator — reads APP_ENV to decide what to seed.
 *
 * APP_ENV=production  → base seed only (services, settings, admin)
 * APP_ENV=staging     → base + demo data
 * APP_ENV=development → base + demo data (default)
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { seedBase } from "./seed-base";
import { seedDemo } from "./seed-demo";
import {
  dispatchLogs,
  providerPayouts,
  payments,
  bookings,
  providers,
  users,
  timeBlockConfigs,
  services,
} from "./schema";
import { sql } from "drizzle-orm";

async function seed() {
  const appEnv = process.env.APP_ENV || "development";
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  console.log(`\n[seed] APP_ENV=${appEnv}`);
  console.log(`[seed] Running base seed (services, settings, admin)...`);

  // Clear existing data in dependency order
  console.log("Clearing existing data...");
  await db.delete(dispatchLogs);
  await db.delete(providerPayouts);
  await db.delete(payments);
  await db.delete(bookings);
  await db.delete(providers);
  await db.execute(sql`DELETE FROM accounts`).catch(() => {});
  await db.execute(sql`DELETE FROM sessions`).catch(() => {});
  await db.delete(users);
  await db.delete(timeBlockConfigs);
  await db.delete(services);

  // Always run base seed
  const baseRefs = await seedBase(db);

  // Demo data for non-production environments
  if (appEnv !== "production") {
    console.log(`\n[seed] APP_ENV=${appEnv} — seeding demo data...`);
    await seedDemo(db, baseRefs);
  } else {
    console.log("\n========================================");
    console.log("  BASE SEED COMPLETE (production)");
    console.log("========================================");
    console.log("  Services, platform settings, time blocks, and admin users seeded.");
    console.log("  No demo data in production.");
    console.log("========================================\n");
  }

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
