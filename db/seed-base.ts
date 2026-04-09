/**
 * Base seed — safe for ALL environments (production, staging, development).
 * Seeds: services catalog, platform settings, time-block configs, admin user(s).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import {
  services,
  users,
  timeBlockConfigs,
  platformSettings,
} from "./schema";

export async function seedBase(db: PostgresJsDatabase) {
  // ── SERVICES ──────────────────────────────────────────────
  console.log("Seeding services...");
  const [svcJump, svcTow, svcLockout, svcTire, svcFuel, , svcDiagStandard] = await db
    .insert(services)
    .values([
      {
        name: "Jump Start",
        slug: "jump-start",
        description:
          "Dead battery? We'll get you running again with a professional jump start service.",
        basePrice: 10000,
        category: "roadside",
        commissionRate: 2500,
        checklistConfig: [{ category: "Jump Start", items: ["Battery Voltage", "Terminal Condition", "Alternator Output", "Cable Integrity"] }],
      },
      {
        name: "Towing (Local)",
        slug: "towing",
        description:
          "Local towing within the Atlanta metro area. $125 base rate plus $3 per mile.",
        basePrice: 12500,
        pricePerMile: 300,
        category: "roadside",
        commissionRate: 2500,
        checklistConfig: [{ category: "Towing", items: ["Frame Condition", "Axle Status", "Steering Lock", "Brake Status"] }],
      },
      {
        name: "Lockout Service",
        slug: "lockout",
        description:
          "Locked out of your car? Our technicians will safely get you back in.",
        basePrice: 13500,
        category: "roadside",
        commissionRate: 2500,
        checklistConfig: [{ category: "Lockout", items: ["Lock Mechanism", "Door Condition", "Key Status", "Window Integrity"] }],
      },
      {
        name: "Flat Tire Change",
        slug: "flat-tire",
        description:
          "We'll swap your flat for your spare tire and get you back on the road. $100 service fee plus cost of tire if needed.",
        basePrice: 10000,
        category: "roadside",
        commissionRate: 2500,
        checklistConfig: [{ category: "Tire Change", items: ["Tread Depth", "Tire Pressure", "Spare Condition", "Lug Nut Torque"] }],
      },
      {
        name: "Fuel Delivery",
        slug: "fuel-delivery",
        description:
          "Ran out of gas? We'll bring enough fuel to get you to the nearest station. $75 delivery fee plus cost of gas.",
        basePrice: 7500,
        category: "roadside",
        commissionRate: 2500,
        checklistConfig: [{ category: "Fuel Delivery", items: ["Fuel Level", "Fuel Line Condition", "Cap Seal", "Tank Integrity"] }],
      },
      {
        name: "Basic Inspection",
        slug: "basic-inspection",
        description:
          "Essential pre-purchase check covering OBD2 scan, visual exterior/interior inspection, fluid levels, tire condition, and battery health.",
        basePrice: 15000,
        category: "diagnostics",
        commissionRate: 2000,
        checklistConfig: [{ category: "Basic Diagnostic", items: ["OBD2 Codes", "Battery Health", "Fluid Levels", "Belt Condition", "Tire Pressure"] }],
      },
      {
        name: "Standard Inspection",
        slug: "standard-inspection",
        description:
          "Comprehensive inspection including OBD2 diagnostics, brake system check, suspension test, electrical system review, engine performance analysis, and photo documentation.",
        basePrice: 25000,
        category: "diagnostics",
        commissionRate: 2000,
      },
      {
        name: "Premium Inspection",
        slug: "premium-inspection",
        description:
          "Complete diagnostic report with full mechanical inspection, detailed OBD2 code analysis, test drive evaluation, undercarriage examination, emissions check, and branded PDF report with repair cost estimates.",
        basePrice: 39900,
        category: "diagnostics",
        commissionRate: 1800,
        checklistConfig: [{ category: "Premium Diagnostic", items: ["OBD2 Codes", "Battery Health", "Fluid Levels", "Belt Condition", "Tire Pressure", "Brake Pad Thickness", "Suspension Check", "Exhaust Emissions"] }],
      },
    ])
    .returning();

  console.log("Services seeded.");

  // ── MECHANIC SERVICES (Beta) ──────────────────────────────
  console.log("Seeding mechanic services...");
  await db.insert(services).values([
    {
      name: "Oil Change",
      slug: "oil-change",
      description: "Full synthetic oil change with filter replacement. Mobile mechanic comes to your location.",
      basePrice: 8500,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 3000,
      checklistConfig: [{ category: "Oil Change", items: ["Oil Level", "Filter Condition", "Drain Plug", "Oil Type Verification"] }],
    },
    {
      name: "Brake Service",
      slug: "brake-service",
      description: "Brake pad inspection and replacement. Includes rotor check and brake fluid level assessment.",
      basePrice: 18000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 3000,
      checklistConfig: [{ category: "Brake Service", items: ["Pad Thickness", "Rotor Condition", "Brake Fluid", "Caliper Function", "Brake Lines"] }],
    },
    {
      name: "Battery Replacement",
      slug: "battery-replace",
      description: "Mobile battery replacement service. Includes testing, removal, and installation of new battery.",
      basePrice: 15000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 3000,
      checklistConfig: [{ category: "Battery Replace", items: ["Terminal Condition", "Voltage Test", "Alternator Output", "Cable Integrity"] }],
    },
    {
      name: "Belt Replacement",
      slug: "belt-replacement",
      description: "Serpentine belt or timing belt replacement. Includes tensioner inspection.",
      basePrice: 22000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 3000,
      checklistConfig: [{ category: "Belt Replacement", items: ["Belt Condition", "Tensioner Check", "Pulley Alignment", "Routing Verification"] }],
    },
    {
      name: "AC Repair",
      slug: "ac-repair",
      description: "Air conditioning diagnosis and repair. Includes refrigerant recharge and leak detection.",
      basePrice: 25000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 3000,
      checklistConfig: [{ category: "AC Repair", items: ["Refrigerant Level", "Compressor Function", "Condenser Check", "Leak Detection"] }],
    },
    {
      name: "General Maintenance",
      slug: "general-maintenance",
      description: "General vehicle maintenance including fluid top-offs, filter checks, and multi-point inspection.",
      basePrice: 12000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 3000,
      checklistConfig: [{ category: "General Maintenance", items: ["Fluid Levels", "Filter Status", "Tire Pressure", "Light Check", "Wiper Condition"] }],
    },
  ]);
  console.log("Mechanic services seeded.");

  // ── BETA CONFIGURATION ──────────────────────────────────────
  console.log("Seeding beta configuration...");
  await db.insert(platformSettings).values([
    { key: "beta_active", value: "false" },
    { key: "beta_start_date", value: "2026-04-07" },
    { key: "beta_end_date", value: "2026-06-07" },
  ]).onConflictDoNothing();
  console.log("Beta configuration seeded.");

  // ── TIME-BLOCK PRICING CONFIGS ──────────────────────────────
  console.log("Seeding time-block pricing configs...");
  await db.insert(timeBlockConfigs).values([
    { name: "Standard", startHour: 6, endHour: 18, multiplier: 10000, isActive: true, priority: 1 },
    { name: "After-Hours", startHour: 18, endHour: 6, multiplier: 12500, isActive: true, priority: 1 },
    { name: "Emergency", startHour: 0, endHour: 24, multiplier: 15000, isActive: false, priority: 1 },
    { name: "Ice Storm", startHour: 0, endHour: 24, multiplier: 15000, isActive: false, priority: 100 },
    { name: "Falcons Game", startHour: 0, endHour: 24, multiplier: 13000, isActive: false, priority: 100 },
    { name: "Holiday Weekend", startHour: 0, endHour: 24, multiplier: 12000, isActive: false, priority: 100 },
  ]);
  console.log("Time-block pricing configs seeded.");

  // ── ADMIN USERS ──────────────────────────────────────────────
  console.log("Seeding admin users...");
  const hashedAdmin = await bcrypt.hash("admin123", 12);
  const [adminSani] = await db
    .insert(users)
    .values([
      {
        name: "Sani Nabil",
        email: "admin@roadsidega.com",
        phone: "(678) 744-8092",
        password: hashedAdmin,
        emailVerified: new Date(),
        role: "admin",
      },
      {
        name: "Ops Manager",
        email: "ops@roadsidega.com",
        phone: "(404) 555-0200",
        password: hashedAdmin,
        emailVerified: new Date(),
        role: "admin",
      },
    ])
    .returning();

  console.log("Admin users seeded.");

  // Return references needed by demo seed
  return {
    adminSani,
    svcJump,
    svcTow,
    svcLockout,
    svcTire,
    svcFuel,
    svcDiagStandard,
  };
}
