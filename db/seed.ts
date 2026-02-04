import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { services, users } from "./schema";

async function seed() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  console.log("Seeding services...");

  await db
    .insert(services)
    .values([
      {
        name: "Jump Start",
        slug: "jump-start",
        description:
          "Dead battery? We'll get you running again with a professional jump start service.",
        basePrice: 7500,
        category: "roadside",
      },
      {
        name: "Towing (Local)",
        slug: "towing",
        description:
          "Local towing within the Atlanta metro area. Base rate includes first 10 miles, $6/mile beyond.",
        basePrice: 12500,
        pricePerMile: 600,
        category: "roadside",
      },
      {
        name: "Lockout Service",
        slug: "lockout",
        description:
          "Locked out of your car? Our technicians will safely get you back in.",
        basePrice: 7500,
        category: "roadside",
      },
      {
        name: "Flat Tire Change",
        slug: "flat-tire",
        description:
          "We'll swap your flat for your spare tire and get you back on the road.",
        basePrice: 10000,
        category: "roadside",
      },
      {
        name: "Fuel Delivery",
        slug: "fuel-delivery",
        description:
          "Ran out of gas? We'll bring enough fuel to get you to the nearest station.",
        basePrice: 7500,
        category: "roadside",
      },
      {
        name: "Car Purchase Diagnostics",
        slug: "car-purchase-diagnostics",
        description:
          "Comprehensive pre-purchase vehicle inspection with OBD2 scan and mechanical grade assessment. Full payment required upfront before scheduling.",
        basePrice: 25000,
        category: "diagnostics",
      },
    ])
    .onConflictDoNothing();

  console.log("Services seeded.");

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    console.log(`Seeding admin user (${adminEmail})...`);
    await db
      .insert(users)
      .values({
        email: adminEmail,
        name: "Admin",
        role: "admin",
      })
      .onConflictDoNothing();
    console.log("Admin user seeded.");
  }

  console.log("Seed complete!");
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
