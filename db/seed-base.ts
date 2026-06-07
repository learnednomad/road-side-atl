/**
 * Base seed — safe for ALL environments (production, staging, development).
 * Seeds: services catalog, platform settings, time-block configs, admin user(s).
 */
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import {
  services,
  users,
  timeBlockConfigs,
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
        estimateMinCents: 8000,
        estimateMaxCents: 15000,
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
        estimateMinCents: 7500,
        estimateMaxCents: 18000,
        estimateNote: "Per-mile beyond 10 mi; flatbed and after-hours extra",
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
        estimateMinCents: 10000,
        estimateMaxCents: 18000,
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
        estimateMinCents: 8000,
        estimateMaxCents: 22000,
        estimateNote: "Tire cost extra if replacement is needed",
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
        estimateMinCents: 6000,
        estimateMaxCents: 12000,
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
        estimateMinCents: 12000,
        estimateMaxCents: 20000,
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
        estimateMinCents: 20000,
        estimateMaxCents: 32000,
        description:
          "Comprehensive inspection including OBD2 diagnostics, brake system check, suspension test, electrical system review, engine performance analysis, and photo documentation.",
        basePrice: 25000,
        category: "diagnostics",
        commissionRate: 2000,
      },
      {
        name: "Premium Inspection",
        slug: "premium-inspection",
        estimateMinCents: 35000,
        estimateMaxCents: 50000,
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

  // ── MECHANIC SERVICES ─────────────────────────────────────
  // Pricing aligned to 2026 Atlanta market (see docs/atlanta_vehicle_service_cost_deep_dive (1).md).
  // Commission tiers: 2200bp standard / 2000bp high-ticket / 1800bp premium dealer-path.
  console.log("Seeding mechanic services...");
  await db.insert(services).values([
    {
      name: "Oil Change",
      slug: "oil-change",
      description: "Full synthetic oil change with filter replacement. Mobile mechanic comes to your location.",
      basePrice: 8500,
      estimateMinCents: 3000,
      estimateMaxCents: 14000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2200,
      checklistConfig: [{ category: "Oil Change", items: ["Oil Level", "Filter Condition", "Drain Plug", "Oil Type Verification"] }],
    },
    {
      name: "Mobile Diagnostic Session",
      slug: "mobile-diagnostic",
      description: "Mobile diagnostic visit: OBD2 scan plus drivability, electrical, or warning-light investigation. Billed separately from repair labor.",
      basePrice: 12500,
      estimateMinCents: 7500,
      estimateMaxCents: 15000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2200,
      checklistConfig: [{ category: "Diagnostic", items: ["OBD2 Codes", "Battery Voltage", "Symptom Reproduction", "Visual Inspection"] }],
    },
    {
      name: "Brake Service (Pads, 1 Axle)",
      slug: "brake-service",
      description: "Brake pad replacement on one axle. Includes rotor inspection and brake fluid check. Rotor replacement quoted separately if needed.",
      basePrice: 27500,
      estimateMinCents: 15000,
      estimateMaxCents: 40000,
      estimateNote: "Rotor replacement quoted separately if needed",
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2000,
      checklistConfig: [{ category: "Brake Service", items: ["Pad Thickness", "Rotor Condition", "Brake Fluid", "Caliper Function", "Brake Lines"] }],
    },
    {
      name: "Brake Service (Pads + Rotors, 1 Axle)",
      slug: "brake-service-rotors",
      description: "Brake pad and rotor replacement on one axle. Includes brake fluid check and bedding-in procedure.",
      basePrice: 45000,
      estimateMinCents: 30000,
      estimateMaxCents: 60000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2000,
      checklistConfig: [{ category: "Brake Service", items: ["Pad Thickness", "Rotor Condition", "Brake Fluid", "Caliper Function", "Brake Lines"] }],
    },
    {
      name: "Battery Replacement",
      slug: "battery-replace",
      description: "Mobile battery replacement service. Includes testing, removal, installation, and terminal cleaning. AGM and trunk-mounted batteries priced separately.",
      basePrice: 21500,
      estimateMinCents: 18000,
      estimateMaxCents: 35000,
      estimateNote: "AGM and trunk-mounted batteries priced higher",
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2200,
      checklistConfig: [{ category: "Battery Replace", items: ["Terminal Condition", "Voltage Test", "Alternator Output", "Cable Integrity"] }],
    },
    {
      name: "Alternator Replacement",
      slug: "alternator-replace",
      description: "Alternator diagnosis and replacement. Includes charging system test and belt inspection.",
      basePrice: 65000,
      estimateMinCents: 45000,
      estimateMaxCents: 90000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2000,
      checklistConfig: [{ category: "Alternator", items: ["Charging Output", "Belt Tension", "Connector Integrity", "Voltage Regulator"] }],
    },
    {
      name: "Starter Replacement",
      slug: "starter-replace",
      description: "Starter motor diagnosis and replacement. Includes cranking-system test.",
      basePrice: 55000,
      estimateMinCents: 35000,
      estimateMaxCents: 80000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2000,
      checklistConfig: [{ category: "Starter", items: ["Cranking Voltage", "Solenoid Click", "Wiring Continuity", "Ground Connection"] }],
    },
    {
      name: "Belt Replacement",
      slug: "belt-replacement",
      description: "Serpentine belt or timing belt replacement. Includes tensioner and pulley inspection.",
      basePrice: 22000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2000,
      checklistConfig: [{ category: "Belt Replacement", items: ["Belt Condition", "Tensioner Check", "Pulley Alignment", "Routing Verification"] }],
    },
    {
      name: "A/C Diagnostic + Recharge",
      slug: "ac-recharge",
      description: "A/C system diagnosis with refrigerant recharge and dye-based leak detection. Component repair quoted separately.",
      basePrice: 25000,
      estimateMinCents: 15000,
      estimateMaxCents: 35000,
      estimateNote: "Component repair quoted separately if leak detected",
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2200,
      checklistConfig: [{ category: "AC Recharge", items: ["Refrigerant Level", "System Pressure", "Leak Detection", "Vent Temperature"] }],
    },
    {
      name: "A/C Repair",
      slug: "ac-repair",
      description: "Air conditioning component repair (compressor, condenser, expansion valve). Includes diagnostic and recharge.",
      basePrice: 45000,
      estimateMinCents: 30000,
      estimateMaxCents: 60000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2000,
      checklistConfig: [{ category: "AC Repair", items: ["Refrigerant Level", "Compressor Function", "Condenser Check", "Leak Detection"] }],
    },
    {
      name: "Wheel Alignment",
      slug: "wheel-alignment",
      description: "Four-wheel alignment with toe, camber, and caster adjustment. ADAS calibration quoted separately if required.",
      basePrice: 14000,
      estimateMinCents: 10000,
      estimateMaxCents: 18000,
      estimateNote: "ADAS calibration quoted separately if vehicle requires it",
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2200,
      checklistConfig: [{ category: "Alignment", items: ["Toe Reading", "Camber Reading", "Caster Reading", "Tire Wear Inspection"] }],
    },
    {
      name: "Suspension Repair",
      slug: "suspension-repair",
      description: "Suspension component replacement (struts, shocks, control arms, ball joints). Pricing per component set; alignment recommended after.",
      basePrice: 60000,
      estimateMinCents: 30000,
      estimateMaxCents: 90000,
      estimateNote: "Per component set; alignment recommended after",
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 1800,
      checklistConfig: [{ category: "Suspension", items: ["Strut/Shock Condition", "Bushing Wear", "Ball Joint Play", "Control Arm Integrity"] }],
    },
    {
      name: "Tune-Up / Ignition Service",
      slug: "tune-up",
      description: "Spark plug replacement, ignition coil inspection, and air filter service. Turbo engines and intake-access jobs priced higher.",
      basePrice: 40000,
      estimateMinCents: 20000,
      estimateMaxCents: 60000,
      estimateNote: "Turbo engines and intake-access jobs priced higher",
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2000,
      checklistConfig: [{ category: "Tune-Up", items: ["Spark Plug Condition", "Coil Output", "Air Filter Status", "Fuel Filter Status"] }],
    },
    {
      name: "Transmission Service",
      slug: "transmission-service",
      description: "Transmission fluid service and filter replacement. Internal transmission repairs quoted separately after diagnosis.",
      basePrice: 42500,
      estimateMinCents: 25000,
      estimateMaxCents: 60000,
      estimateNote: "Internal transmission repairs quoted separately",
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 1800,
      checklistConfig: [{ category: "Transmission", items: ["Fluid Level", "Fluid Condition", "Pan Condition", "Filter Status"] }],
    },
    {
      name: "General Maintenance",
      slug: "general-maintenance",
      description: "General vehicle maintenance including fluid top-offs, filter checks, and multi-point inspection.",
      basePrice: 12000,
      category: "mechanics",
      schedulingMode: "scheduled",
      commissionRate: 2200,
      checklistConfig: [{ category: "General Maintenance", items: ["Fluid Levels", "Filter Status", "Tire Pressure", "Light Check", "Wiper Condition"] }],
    },
  ]);
  console.log("Mechanic services seeded.");


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
  // No hardcoded default — require an explicit ADMIN_PASSWORD so a real
  // password is never baked into source or shipped to production.
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD env var is required to seed admin users (min 12 chars). Refusing to seed a default password."
    );
  }
  const hashedAdmin = await bcrypt.hash(adminPassword, 12);
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
