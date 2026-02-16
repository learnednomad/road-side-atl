// Load dotenv only if available (not in Docker production where env vars are already set)
try {
  require("dotenv/config");
} catch {
  // dotenv not available in production build - environment variables should already be set
}
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import {
  services,
  users,
  providers,
  bookings,
  payments,
  providerPayouts,
  dispatchLogs,
  timeBlockConfigs,
} from "./schema";
import { eq, sql } from "drizzle-orm";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 12) + 7, Math.floor(Math.random() * 60));
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n, Math.floor(Math.random() * 60));
  return d;
}

async function seed() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

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

  // ── SERVICES ──────────────────────────────────────────────
  console.log("Seeding services...");
  const [svcJump, svcTow, svcLockout, svcTire, svcFuel, svcDiag] = await db
    .insert(services)
    .values([
      {
        name: "Jump Start",
        slug: "jump-start",
        description:
          "Dead battery? We'll get you running again with a professional jump start service.",
        basePrice: 10000,
        category: "roadside",
      },
      {
        name: "Towing (Local)",
        slug: "towing",
        description:
          "Local towing within the Atlanta metro area. $125 base rate plus $3 per mile.",
        basePrice: 12500,
        pricePerMile: 300,
        category: "roadside",
      },
      {
        name: "Lockout Service",
        slug: "lockout",
        description:
          "Locked out of your car? Our technicians will safely get you back in.",
        basePrice: 13500,
        category: "roadside",
      },
      {
        name: "Flat Tire Change",
        slug: "flat-tire",
        description:
          "We'll swap your flat for your spare tire and get you back on the road. $100 service fee plus cost of tire if needed.",
        basePrice: 10000,
        category: "roadside",
      },
      {
        name: "Fuel Delivery",
        slug: "fuel-delivery",
        description:
          "Ran out of gas? We'll bring enough fuel to get you to the nearest station. $75 delivery fee plus cost of gas.",
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
    .returning();

  console.log("Services seeded.");

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

  // ── PASSWORDS ──────────────────────────────────────────────
  const hashedAdmin = await bcrypt.hash("admin123", 12);
  const hashedProvider = await bcrypt.hash("provider123", 12);
  const hashedCustomer = await bcrypt.hash("customer123", 12);

  // ── ADMIN USERS ──────────────────────────────────────────────
  console.log("Seeding admin users...");
  const [adminSani, adminOps] = await db
    .insert(users)
    .values([
      {
        name: "Sani Nabil",
        email: "admin@roadsideatl.com",
        phone: "(678) 744-8092",
        password: hashedAdmin,
        emailVerified: new Date(),
        role: "admin",
      },
      {
        name: "Ops Manager",
        email: "ops@roadsideatl.com",
        phone: "(404) 555-0200",
        password: hashedAdmin,
        emailVerified: new Date(),
        role: "admin",
      },
    ])
    .returning();

  // ── CUSTOMER USERS ──────────────────────────────────────────────
  console.log("Seeding customer users...");
  const customerData = [
    { name: "Jasmine Carter", email: "jasmine.carter@gmail.com", phone: "(404) 312-7845" },
    { name: "David Okonkwo", email: "david.okonkwo@gmail.com", phone: "(678) 924-1056" },
    { name: "Maria Santos", email: "maria.santos@yahoo.com", phone: "(770) 481-3920" },
    { name: "Tyler Richardson", email: "tyler.rich@outlook.com", phone: "(404) 657-2384" },
    { name: "Aisha Washington", email: "aisha.w@gmail.com", phone: "(678) 193-4572" },
    { name: "Kevin Tran", email: "kevin.tran@gmail.com", phone: "(770) 846-3019" },
    { name: "Brittany Coleman", email: "brittany.coleman@gmail.com", phone: "(404) 725-1893" },
    { name: "James Mitchell", email: "james.mitchell@outlook.com", phone: "(678) 504-2761" },
    { name: "Stephanie Park", email: "steph.park@gmail.com", phone: "(770) 312-9048" },
    { name: "Andre Williams", email: "andre.w@yahoo.com", phone: "(404) 861-5734" },
    { name: "Nicole Foster", email: "nicole.foster@gmail.com", phone: "(678) 437-8126" },
    { name: "Marcus Green", email: "marcus.green@gmail.com", phone: "(770) 529-4037" },
  ];

  const customers = await db
    .insert(users)
    .values(
      customerData.map((c) => ({
        ...c,
        password: hashedCustomer,
        emailVerified: new Date(),
        role: "customer" as const,
      }))
    )
    .returning();

  // ── PROVIDER USERS + PROFILES ──────────────────────────────────
  console.log("Seeding provider users and profiles...");
  const providerData = [
    {
      name: "Marcus Johnson",
      email: "marcus@roadsideatl.com",
      phone: "(404) 555-0101",
      commissionRate: 7000,
      commissionType: "percentage" as const,
      status: "active" as const,
      specialties: ["roadside", "diagnostics"],
      latitude: 33.749,
      longitude: -84.388,
      address: "55 Trinity Ave SW, Atlanta, GA 30303",
      isAvailable: true,
    },
    {
      name: "Terrence Williams",
      email: "terrence@roadsideatl.com",
      phone: "(404) 555-0102",
      commissionRate: 6500,
      commissionType: "percentage" as const,
      status: "active" as const,
      specialties: ["roadside"],
      latitude: 33.838,
      longitude: -84.362,
      address: "3340 Peachtree Rd NE, Atlanta, GA 30326",
      isAvailable: true,
    },
    {
      name: "DeAndre Smith",
      email: "deandre@roadsideatl.com",
      phone: "(404) 555-0103",
      commissionRate: 7000,
      commissionType: "percentage" as const,
      status: "active" as const,
      specialties: ["roadside"],
      latitude: 33.710,
      longitude: -84.410,
      address: "868 Ralph David Abernathy Blvd, Atlanta, GA 30310",
      isAvailable: false,
    },
    {
      name: "Carlos Rivera",
      email: "carlos@roadsideatl.com",
      phone: "(678) 555-0104",
      commissionRate: 5000,
      commissionType: "flat_per_job" as const,
      flatFeeAmount: 5000,
      status: "active" as const,
      specialties: ["roadside", "diagnostics"],
      latitude: 33.876,
      longitude: -84.460,
      address: "2841 Greenbriar Pkwy SW, Atlanta, GA 30331",
      isAvailable: true,
    },
    {
      name: "Jamal Osei",
      email: "jamal@roadsideatl.com",
      phone: "(770) 555-0105",
      commissionRate: 6500,
      commissionType: "percentage" as const,
      status: "pending" as const,
      specialties: ["roadside"],
      latitude: 33.652,
      longitude: -84.449,
      address: "4275 Jonesboro Rd, Union City, GA 30291",
      isAvailable: false,
    },
  ];

  const providerUsers = await db
    .insert(users)
    .values(
      providerData.map((p) => ({
        name: p.name,
        email: p.email,
        phone: p.phone,
        password: hashedProvider,
        emailVerified: new Date(),
        role: "provider" as const,
      }))
    )
    .returning();

  const providerRecords = await db
    .insert(providers)
    .values(
      providerData.map((p, i) => ({
        userId: providerUsers[i].id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        commissionRate: p.commissionRate,
        commissionType: p.commissionType,
        flatFeeAmount: (p as { flatFeeAmount?: number }).flatFeeAmount ?? null,
        status: p.status,
        specialties: p.specialties,
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address,
        isAvailable: p.isAvailable,
      }))
    )
    .returning();

  const [provMarcus, provTerrence, provDeAndre, provCarlos, provJamal] = providerRecords;

  // ── BOOKINGS ──────────────────────────────────────────────
  // Real Atlanta-area locations, realistic vehicles, full status coverage
  console.log("Seeding bookings...");

  const allBookings = await db
    .insert(bookings)
    .values([
      // ── COMPLETED bookings (historical) ──
      {
        userId: customers[0].id,
        serviceId: svcJump.id,
        status: "completed",
        vehicleInfo: { year: "2019", make: "Honda", model: "Civic", color: "Silver" },
        location: {
          address: "1380 Atlantic Dr NW, Atlanta, GA 30363",
          latitude: 33.7914,
          longitude: -84.3963,
          notes: "Atlantic Station parking garage, level 3",
        },
        contactName: "Jasmine Carter",
        contactPhone: "(404) 312-7845",
        contactEmail: "jasmine.carter@gmail.com",
        estimatedPrice: 10000,
        finalPrice: 10000,
        providerId: provMarcus.id,
        createdAt: daysAgo(28),
        updatedAt: daysAgo(28),
      },
      {
        userId: customers[1].id,
        serviceId: svcTow.id,
        status: "completed",
        vehicleInfo: { year: "2017", make: "BMW", model: "328i", color: "Black" },
        location: {
          address: "2685 Metropolitan Pkwy SW, Atlanta, GA 30315",
          latitude: 33.6892,
          longitude: -84.4044,
          destination: "Peachtree Hills Auto, 2285 Peachtree Rd NE, Atlanta, GA 30309",
          destinationLatitude: 33.8145,
          destinationLongitude: -84.3622,
          estimatedMiles: 12,
        },
        contactName: "David Okonkwo",
        contactPhone: "(678) 924-1056",
        contactEmail: "david.okonkwo@gmail.com",
        estimatedPrice: 16100,
        finalPrice: 16100,
        towingMiles: 12,
        providerId: provTerrence.id,
        createdAt: daysAgo(25),
        updatedAt: daysAgo(25),
      },
      {
        userId: customers[2].id,
        serviceId: svcLockout.id,
        status: "completed",
        vehicleInfo: { year: "2022", make: "Toyota", model: "Camry", color: "White" },
        location: {
          address: "3393 Peachtree Rd NE, Atlanta, GA 30326",
          latitude: 33.8476,
          longitude: -84.3625,
          notes: "Lenox Square Mall valet area",
        },
        contactName: "Maria Santos",
        contactPhone: "(770) 481-3920",
        contactEmail: "maria.santos@yahoo.com",
        estimatedPrice: 13500,
        finalPrice: 13500,
        providerId: provMarcus.id,
        createdAt: daysAgo(22),
        updatedAt: daysAgo(22),
      },
      {
        userId: customers[3].id,
        serviceId: svcDiag.id,
        status: "completed",
        vehicleInfo: { year: "2016", make: "Chevrolet", model: "Malibu", color: "Red" },
        location: {
          address: "4166 Buford Hwy NE, Atlanta, GA 30345",
          latitude: 33.8511,
          longitude: -84.3135,
          notes: "Seller's address. Meet at driveway.",
        },
        contactName: "Tyler Richardson",
        contactPhone: "(404) 657-2384",
        contactEmail: "tyler.rich@outlook.com",
        estimatedPrice: 25000,
        finalPrice: 25000,
        providerId: provCarlos.id,
        createdAt: daysAgo(20),
        updatedAt: daysAgo(20),
      },
      {
        userId: customers[4].id,
        serviceId: svcTire.id,
        status: "completed",
        vehicleInfo: { year: "2021", make: "Hyundai", model: "Tucson", color: "Blue" },
        location: {
          address: "I-285 Eastbound near Exit 39, Decatur, GA 30034",
          latitude: 33.6892,
          longitude: -84.2564,
          notes: "Pulled over on the shoulder, hazards on",
        },
        contactName: "Aisha Washington",
        contactPhone: "(678) 193-4572",
        contactEmail: "aisha.w@gmail.com",
        estimatedPrice: 10000,
        finalPrice: 10000,
        providerId: provTerrence.id,
        createdAt: daysAgo(18),
        updatedAt: daysAgo(18),
      },
      {
        userId: customers[5].id,
        serviceId: svcFuel.id,
        status: "completed",
        vehicleInfo: { year: "2020", make: "Nissan", model: "Altima", color: "Gray" },
        location: {
          address: "Camp Creek Pkwy at I-285, East Point, GA 30344",
          latitude: 33.6562,
          longitude: -84.4926,
          notes: "Eastbound lane, right shoulder",
        },
        contactName: "Kevin Tran",
        contactPhone: "(770) 846-3019",
        contactEmail: "kevin.tran@gmail.com",
        estimatedPrice: 7500,
        finalPrice: 7500,
        providerId: provDeAndre.id,
        createdAt: daysAgo(15),
        updatedAt: daysAgo(15),
      },
      {
        userId: customers[6].id,
        serviceId: svcJump.id,
        status: "completed",
        vehicleInfo: { year: "2018", make: "Ford", model: "Explorer", color: "White" },
        location: {
          address: "725 Ponce De Leon Ave NE, Atlanta, GA 30306",
          latitude: 33.7727,
          longitude: -84.3655,
          notes: "Ponce City Market parking deck",
        },
        contactName: "Brittany Coleman",
        contactPhone: "(404) 725-1893",
        contactEmail: "brittany.coleman@gmail.com",
        estimatedPrice: 10000,
        finalPrice: 10000,
        providerId: provMarcus.id,
        createdAt: daysAgo(12),
        updatedAt: daysAgo(12),
      },
      {
        userId: customers[7].id,
        serviceId: svcTow.id,
        status: "completed",
        vehicleInfo: { year: "2015", make: "Jeep", model: "Grand Cherokee", color: "Green" },
        location: {
          address: "1700 Northside Dr NW, Atlanta, GA 30318",
          latitude: 33.7944,
          longitude: -84.4177,
          destination: "Import Auto Clinic, 1840 Cheshire Bridge Rd NE, Atlanta, GA 30324",
          destinationLatitude: 33.8160,
          destinationLongitude: -84.3530,
          estimatedMiles: 8,
        },
        contactName: "James Mitchell",
        contactPhone: "(678) 504-2761",
        contactEmail: "james.mitchell@outlook.com",
        estimatedPrice: 14900,
        finalPrice: 14900,
        towingMiles: 8,
        providerId: provCarlos.id,
        createdAt: daysAgo(10),
        updatedAt: daysAgo(10),
      },
      {
        userId: customers[8].id,
        serviceId: svcLockout.id,
        status: "completed",
        vehicleInfo: { year: "2023", make: "Kia", model: "Forte", color: "Black" },
        location: {
          address: "48 Alabama St SW, Atlanta, GA 30303",
          latitude: 33.7514,
          longitude: -84.3907,
          notes: "Underground Atlanta, street level entrance",
        },
        contactName: "Stephanie Park",
        contactPhone: "(770) 312-9048",
        contactEmail: "steph.park@gmail.com",
        estimatedPrice: 13500,
        finalPrice: 13500,
        providerId: provTerrence.id,
        createdAt: daysAgo(7),
        updatedAt: daysAgo(7),
      },
      {
        userId: customers[9].id,
        serviceId: svcTire.id,
        status: "completed",
        vehicleInfo: { year: "2020", make: "Dodge", model: "Charger", color: "Red" },
        location: {
          address: "North Ave NW at Techwood Dr, Atlanta, GA 30332",
          latitude: 33.7711,
          longitude: -84.3920,
          notes: "Near Georgia Tech campus, front right tire blew",
        },
        contactName: "Andre Williams",
        contactPhone: "(404) 861-5734",
        contactEmail: "andre.w@yahoo.com",
        estimatedPrice: 10000,
        finalPrice: 10000,
        providerId: provMarcus.id,
        createdAt: daysAgo(5),
        updatedAt: daysAgo(5),
      },
      {
        userId: customers[10].id,
        serviceId: svcJump.id,
        status: "completed",
        vehicleInfo: { year: "2021", make: "Mazda", model: "CX-5", color: "Soul Red" },
        location: {
          address: "4400 Ashford Dunwoody Rd, Dunwoody, GA 30346",
          latitude: 33.9230,
          longitude: -84.3413,
          notes: "Perimeter Mall parking lot near Nordstrom",
        },
        contactName: "Nicole Foster",
        contactPhone: "(678) 437-8126",
        contactEmail: "nicole.foster@gmail.com",
        estimatedPrice: 10000,
        finalPrice: 10000,
        providerId: provTerrence.id,
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
      },
      // ── CANCELLED booking ──
      {
        userId: customers[11].id,
        serviceId: svcTow.id,
        status: "cancelled",
        vehicleInfo: { year: "2014", make: "Chevrolet", model: "Cruze", color: "Silver" },
        location: {
          address: "240 Peachtree St NW, Atlanta, GA 30303",
          latitude: 33.7590,
          longitude: -84.3880,
          destination: "Pep Boys, 2355 Cheshire Bridge Rd NE, Atlanta, GA 30324",
          destinationLatitude: 33.8175,
          destinationLongitude: -84.3500,
          estimatedMiles: 7,
        },
        contactName: "Marcus Green",
        contactPhone: "(770) 529-4037",
        contactEmail: "marcus.green@gmail.com",
        estimatedPrice: 14600,
        notes: "Customer cancelled — got a friend to help instead",
        createdAt: daysAgo(14),
        updatedAt: daysAgo(14),
      },

      // ── IN PROGRESS booking ──
      {
        userId: customers[0].id,
        serviceId: svcTow.id,
        status: "in_progress",
        vehicleInfo: { year: "2019", make: "Honda", model: "Civic", color: "Silver" },
        location: {
          address: "I-75 Southbound near Exit 247, Atlanta, GA 30339",
          latitude: 33.8817,
          longitude: -84.4632,
          destination: "AutoNation Honda, 2880 North Druid Hills Rd, Atlanta, GA 30329",
          destinationLatitude: 33.8148,
          destinationLongitude: -84.3210,
          estimatedMiles: 15,
          notes: "Engine overheated, pulled to emergency lane. Hazards on.",
        },
        contactName: "Jasmine Carter",
        contactPhone: "(404) 312-7845",
        contactEmail: "jasmine.carter@gmail.com",
        estimatedPrice: 17000,
        towingMiles: 15,
        providerId: provMarcus.id,
        createdAt: hoursAgo(1),
        updatedAt: hoursAgo(0),
      },

      // ── DISPATCHED bookings ──
      {
        userId: customers[1].id,
        serviceId: svcLockout.id,
        status: "dispatched",
        vehicleInfo: { year: "2017", make: "BMW", model: "328i", color: "Black" },
        location: {
          address: "3500 Lenox Rd NE, Atlanta, GA 30326",
          latitude: 33.8460,
          longitude: -84.3576,
          notes: "Phipps Plaza parking garage, level 2",
        },
        contactName: "David Okonkwo",
        contactPhone: "(678) 924-1056",
        contactEmail: "david.okonkwo@gmail.com",
        estimatedPrice: 13500,
        providerId: provTerrence.id,
        createdAt: hoursAgo(2),
        updatedAt: hoursAgo(1),
      },

      // ── CONFIRMED bookings (awaiting dispatch) ──
      {
        userId: customers[2].id,
        serviceId: svcDiag.id,
        status: "confirmed",
        vehicleInfo: { year: "2018", make: "Mercedes-Benz", model: "C300", color: "Navy" },
        location: {
          address: "1250 W Paces Ferry Rd NW, Atlanta, GA 30327",
          latitude: 33.8407,
          longitude: -84.4106,
          notes: "Private seller. Vehicle in garage. Buyer meeting at 2pm.",
        },
        contactName: "Maria Santos",
        contactPhone: "(770) 481-3920",
        contactEmail: "maria.santos@yahoo.com",
        scheduledAt: hoursAgo(-3), // 3 hours from now
        estimatedPrice: 25000,
        createdAt: hoursAgo(6),
        updatedAt: hoursAgo(4),
      },

      // ── PENDING bookings (just submitted) ──
      {
        userId: customers[3].id,
        serviceId: svcJump.id,
        status: "pending",
        vehicleInfo: { year: "2022", make: "Tesla", model: "Model 3", color: "White" },
        location: {
          address: "200 Peachtree St NE, Atlanta, GA 30303",
          latitude: 33.7603,
          longitude: -84.3868,
          notes: "12V battery dead, not the main battery. Office parking deck level B2.",
        },
        contactName: "Tyler Richardson",
        contactPhone: "(404) 657-2384",
        contactEmail: "tyler.rich@outlook.com",
        estimatedPrice: 10000,
        createdAt: hoursAgo(0),
        updatedAt: hoursAgo(0),
      },
      {
        userId: customers[5].id,
        serviceId: svcTire.id,
        status: "pending",
        vehicleInfo: { year: "2020", make: "Nissan", model: "Altima", color: "Gray" },
        location: {
          address: "GA-400 Northbound near Exit 7A, Sandy Springs, GA 30328",
          latitude: 33.9320,
          longitude: -84.3530,
          notes: "Front left tire flat. On right shoulder past the Abernathy Rd exit.",
        },
        contactName: "Kevin Tran",
        contactPhone: "(770) 846-3019",
        contactEmail: "kevin.tran@gmail.com",
        estimatedPrice: 10000,
        createdAt: hoursAgo(0),
        updatedAt: hoursAgo(0),
      },
      {
        userId: customers[7].id,
        serviceId: svcFuel.id,
        status: "pending",
        vehicleInfo: { year: "2015", make: "Jeep", model: "Grand Cherokee", color: "Green" },
        location: {
          address: "Moreland Ave SE at I-20, Atlanta, GA 30316",
          latitude: 33.7405,
          longitude: -84.3513,
          notes: "Ran out of gas merging onto I-20 East. Pulled to shoulder.",
        },
        contactName: "James Mitchell",
        contactPhone: "(678) 504-2761",
        contactEmail: "james.mitchell@outlook.com",
        estimatedPrice: 7500,
        createdAt: hoursAgo(0),
        updatedAt: hoursAgo(0),
      },
      {
        userId: null, // walk-in, no account
        serviceId: svcTow.id,
        status: "pending",
        vehicleInfo: { year: "2016", make: "Ford", model: "F-150", color: "Blue" },
        location: {
          address: "2140 Peachtree Rd NW, Atlanta, GA 30309",
          latitude: 33.8070,
          longitude: -84.3620,
          destination: "Firestone, 3035 Peachtree Rd NE, Atlanta, GA 30305",
          destinationLatitude: 33.8377,
          destinationLongitude: -84.3615,
          estimatedMiles: 4,
          notes: "Won't start. Grinding noise when turning key.",
        },
        contactName: "Robert Jackson",
        contactPhone: "(404) 289-5614",
        contactEmail: "rjackson82@gmail.com",
        estimatedPrice: 13700,
        createdAt: hoursAgo(0),
        updatedAt: hoursAgo(0),
      },
    ])
    .returning();

  console.log(`Seeded ${allBookings.length} bookings.`);

  // ── PAYMENTS ──────────────────────────────────────────────
  console.log("Seeding payments...");
  const completedBookings = allBookings.filter((b) => b.status === "completed");
  const paymentMethods: ("cash" | "cashapp" | "zelle" | "stripe")[] = [
    "cashapp", "zelle", "cash", "stripe", "cashapp",
    "zelle", "cash", "cashapp", "stripe", "zelle", "cash",
  ];

  const paymentRecords = await db
    .insert(payments)
    .values(
      completedBookings.map((b, i) => ({
        bookingId: b.id,
        amount: b.finalPrice!,
        method: paymentMethods[i % paymentMethods.length],
        status: "confirmed" as const,
        confirmedAt: b.updatedAt,
        confirmedBy: adminSani.id,
        createdAt: b.createdAt,
      }))
    )
    .returning();

  // Payment for in-progress booking (pending)
  const inProgressBooking = allBookings.find((b) => b.status === "in_progress")!;
  await db.insert(payments).values({
    bookingId: inProgressBooking.id,
    amount: inProgressBooking.estimatedPrice,
    method: "cashapp",
    status: "pending",
    createdAt: inProgressBooking.createdAt,
  });

  // Payment for dispatched booking (pending)
  const dispatchedBooking = allBookings.find((b) => b.status === "dispatched")!;
  await db.insert(payments).values({
    bookingId: dispatchedBooking.id,
    amount: dispatchedBooking.estimatedPrice,
    method: "zelle",
    status: "pending",
    createdAt: dispatchedBooking.createdAt,
  });

  console.log(`Seeded ${paymentRecords.length + 2} payments.`);

  // ── PROVIDER PAYOUTS ──────────────────────────────────────────────
  console.log("Seeding provider payouts...");
  const payoutData: { providerId: string; bookingId: string; amount: number; status: "paid" | "pending"; paidAt?: Date }[] = [];

  for (const b of completedBookings) {
    if (!b.providerId || !b.finalPrice) continue;
    const provider = providerRecords.find((p) => p.id === b.providerId);
    if (!provider) continue;

    let providerShare: number;
    if (provider.commissionType === "flat_per_job") {
      providerShare = provider.flatFeeAmount ?? 5000;
    } else {
      providerShare = Math.round((b.finalPrice * provider.commissionRate) / 10000);
    }

    // Older payouts are paid, recent ones still pending
    const isPaid = b.createdAt < daysAgo(8);
    payoutData.push({
      providerId: provider.id,
      bookingId: b.id,
      amount: providerShare,
      status: isPaid ? "paid" : "pending",
      paidAt: isPaid ? daysAgo(Math.max(0, Math.floor((Date.now() - b.createdAt.getTime()) / 86400000) - 2)) : undefined,
    });
  }

  if (payoutData.length > 0) {
    await db.insert(providerPayouts).values(payoutData);
  }
  console.log(`Seeded ${payoutData.length} provider payouts.`);

  // ── DISPATCH LOGS ──────────────────────────────────────────────
  console.log("Seeding dispatch logs...");
  const assignedBookings = allBookings.filter((b) => b.providerId);
  const dispatchData = assignedBookings.map((b) => {
    const assigned = providerRecords.find((p) => p.id === b.providerId);
    return {
      bookingId: b.id,
      assignedProviderId: b.providerId!,
      algorithm: (Math.random() > 0.4 ? "auto" : "manual") as "auto" | "manual",
      distanceMeters: Math.floor(Math.random() * 15000) + 1000,
      candidateProviders: providerRecords
        .filter((p) => p.status === "active")
        .map((p) => ({
          providerId: p.id,
          name: p.name,
          distanceMiles: +(Math.random() * 20 + 1).toFixed(1),
          specialtyMatch: p.specialties?.includes("roadside") ?? false,
        })),
      reason: assigned
        ? `Assigned to ${assigned.name} — nearest available provider with matching specialty`
        : "Manual assignment by admin",
      createdAt: b.createdAt,
    };
  });

  if (dispatchData.length > 0) {
    await db.insert(dispatchLogs).values(dispatchData);
  }
  console.log(`Seeded ${dispatchData.length} dispatch logs.`);

  // ── SUMMARY ──────────────────────────────────────────────
  console.log("\n========================================");
  console.log("  DEMO SEED COMPLETE");
  console.log("========================================");
  console.log("\n  LOGIN ACCOUNTS:");
  console.log("  ─────────────────────────────────────");
  console.log("  ADMINS:");
  console.log("    admin@roadsideatl.com      / admin123");
  console.log("    ops@roadsideatl.com        / admin123");
  console.log("\n  PROVIDERS:");
  console.log("    marcus@roadsideatl.com     / provider123");
  console.log("    terrence@roadsideatl.com   / provider123");
  console.log("    deandre@roadsideatl.com    / provider123");
  console.log("    carlos@roadsideatl.com     / provider123");
  console.log("    jamal@roadsideatl.com      / provider123  (pending approval)");
  console.log("\n  CUSTOMERS:");
  console.log("    jasmine.carter@gmail.com   / customer123");
  console.log("    david.okonkwo@gmail.com    / customer123");
  console.log("    maria.santos@yahoo.com     / customer123");
  console.log("    tyler.rich@outlook.com     / customer123");
  console.log("    aisha.w@gmail.com          / customer123");
  console.log("    kevin.tran@gmail.com       / customer123");
  console.log("    brittany.coleman@gmail.com / customer123");
  console.log("    james.mitchell@outlook.com / customer123");
  console.log("    steph.park@gmail.com       / customer123");
  console.log("    andre.w@yahoo.com          / customer123");
  console.log("    nicole.foster@gmail.com    / customer123");
  console.log("    marcus.green@gmail.com     / customer123");
  console.log("  ─────────────────────────────────────");
  console.log(`\n  DATA: ${allBookings.length} bookings, ${paymentRecords.length + 2} payments,`);
  console.log(`         ${payoutData.length} payouts, ${dispatchData.length} dispatch logs`);
  console.log("========================================\n");

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
