import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "@/db";
import { payments, bookings, services, providerPayouts, timeBlockConfigs, providers } from "@/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { rateLimitStandard } from "../middleware/rate-limit";
import { generateCSV } from "@/lib/csv";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);
app.use("/*", rateLimitStandard);

const revenueQuerySchema = z.object({
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  source: z.enum(["b2c", "b2b"]).optional(),
  category: z.enum(["roadside", "diagnostics"]).optional(),
  method: z.enum(["cash", "cashapp", "zelle", "stripe"]).optional(),
  tier: z.enum(["standard", "after-hours", "storm-mode"]).optional(),
});

function buildRevenueFilters(params: z.infer<typeof revenueQuerySchema>) {
  const conditions = [sql`${payments.status} = 'confirmed'`];

  if (params.startDate) {
    conditions.push(sql`${payments.createdAt} >= ${params.startDate}`);
  }
  if (params.endDate) {
    conditions.push(sql`${payments.createdAt} <= ${params.endDate}`);
  }
  if (params.source === "b2c") {
    conditions.push(sql`${bookings.tenantId} IS NULL`);
  } else if (params.source === "b2b") {
    conditions.push(sql`${bookings.tenantId} IS NOT NULL`);
  }
  if (params.category) {
    conditions.push(sql`${services.category} = ${params.category}`);
  }
  if (params.method) {
    conditions.push(sql`${payments.method} = ${params.method}`);
  }

  return conditions;
}

function getTimeBlockTierSql() {
  const bookingHour = sql<number>`EXTRACT(HOUR FROM ${bookings.createdAt})`;
  const activeTier = sql<string>`(
    SELECT ${timeBlockConfigs.name}
    FROM ${timeBlockConfigs}
    WHERE ${timeBlockConfigs.isActive} = true
      AND (
        ${timeBlockConfigs.priority} >= 100
        OR (
          (${timeBlockConfigs.startHour} <= ${timeBlockConfigs.endHour}
            AND ${bookingHour} >= ${timeBlockConfigs.startHour}
            AND ${bookingHour} < ${timeBlockConfigs.endHour})
          OR (${timeBlockConfigs.startHour} > ${timeBlockConfigs.endHour}
            AND (${bookingHour} >= ${timeBlockConfigs.startHour}
              OR ${bookingHour} < ${timeBlockConfigs.endHour}))
        )
      )
    ORDER BY ${timeBlockConfigs.priority} DESC
    LIMIT 1
  )`;

  return sql<string>`COALESCE(${activeTier}, 'Standard')`;
}

const effectiveRevenueSql = sql<number>`coalesce(${bookings.priceOverrideCents}, ${payments.amount})`;

// CSV export must be registered BEFORE parameterized routes
app.get("/revenue-breakdown/export", async (c) => {
  const parsed = revenueQuerySchema.safeParse({
    startDate: c.req.query("startDate"),
    endDate: c.req.query("endDate"),
    source: c.req.query("source"),
    category: c.req.query("category"),
    method: c.req.query("method"),
    tier: c.req.query("tier"),
  });

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const params = parsed.data;
  const conditions = buildRevenueFilters(params);
  const tierSql = getTimeBlockTierSql();

  if (params.tier) {
    const tierMap: Record<string, string> = {
      "standard": "Standard",
      "after-hours": "After-Hours",
      "storm-mode": "Storm Mode",
    };
    conditions.push(sql`(${tierSql}) = ${tierMap[params.tier]}`);
  }

  const whereClause = conditions.length > 1
    ? sql.join(conditions, sql` AND `)
    : conditions[0];

  const rows = await db
    .select({
      date: sql<string>`to_char(${payments.createdAt}, 'YYYY-MM-DD')`,
      source: sql<string>`CASE WHEN ${bookings.tenantId} IS NULL THEN 'B2C' ELSE 'B2B' END`,
      category: services.category,
      method: payments.method,
      tier: tierSql,
      revenue: effectiveRevenueSql,
      bookingId: bookings.id,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(whereClause);

  const csvHeaders = ["Date", "Source", "Category", "Payment Method", "Time Block Tier", "Revenue (cents)", "Booking ID"];
  const csvRows = rows.map((r) => [
    r.date,
    r.source,
    r.category,
    r.method,
    r.tier,
    r.revenue,
    r.bookingId,
  ]);

  const csv = generateCSV(csvHeaders, csvRows);

  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename="revenue-breakdown-${new Date().toISOString().split("T")[0]}.csv"`);
  return c.body(csv);
});

app.get("/revenue-breakdown", async (c) => {
  const parsed = revenueQuerySchema.safeParse({
    startDate: c.req.query("startDate"),
    endDate: c.req.query("endDate"),
    source: c.req.query("source"),
    category: c.req.query("category"),
    method: c.req.query("method"),
    tier: c.req.query("tier"),
  });

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const params = parsed.data;
  const conditions = buildRevenueFilters(params);
  const tierSql = getTimeBlockTierSql();

  if (params.tier) {
    const tierMap: Record<string, string> = {
      "standard": "Standard",
      "after-hours": "After-Hours",
      "storm-mode": "Storm Mode",
    };
    conditions.push(sql`(${tierSql}) = ${tierMap[params.tier]}`);
  }

  const whereClause = conditions.length > 1
    ? sql.join(conditions, sql` AND `)
    : conditions[0];

  // Totals
  const [totals] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${effectiveRevenueSql}), 0)`,
      bookingCount: sql<number>`count(distinct ${bookings.id})`,
      avgBookingValue: sql<number>`coalesce(sum(${effectiveRevenueSql}) / nullif(count(distinct ${bookings.id}), 0), 0)`,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(whereClause);

  // By source (B2B/B2C)
  const bySource = await db
    .select({
      source: sql<string>`CASE WHEN ${bookings.tenantId} IS NULL THEN 'B2C' ELSE 'B2B' END`,
      revenue: sql<number>`coalesce(sum(${effectiveRevenueSql}), 0)`,
      count: sql<number>`count(distinct ${bookings.id})`,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(whereClause)
    .groupBy(sql`CASE WHEN ${bookings.tenantId} IS NULL THEN 'B2C' ELSE 'B2B' END`);

  // By category
  const byCategory = await db
    .select({
      category: services.category,
      revenue: sql<number>`coalesce(sum(${effectiveRevenueSql}), 0)`,
      count: sql<number>`count(distinct ${bookings.id})`,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(whereClause)
    .groupBy(services.category);

  // By payment method
  const byMethod = await db
    .select({
      method: payments.method,
      revenue: sql<number>`coalesce(sum(${effectiveRevenueSql}), 0)`,
      count: sql<number>`count(distinct ${bookings.id})`,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(whereClause)
    .groupBy(payments.method);

  // By time-block tier
  const byTier = await db
    .select({
      tier: tierSql,
      revenue: sql<number>`coalesce(sum(${effectiveRevenueSql}), 0)`,
      count: sql<number>`count(distinct ${bookings.id})`,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(whereClause)
    .groupBy(tierSql);

  // Daily trend
  const dailyTrend = await db
    .select({
      date: sql<string>`to_char(${payments.createdAt}, 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(${effectiveRevenueSql}), 0)`,
      count: sql<number>`count(distinct ${bookings.id})`,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(whereClause)
    .groupBy(sql`to_char(${payments.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${payments.createdAt}, 'YYYY-MM-DD')`);

  return c.json({
    totals: {
      revenue: Number(totals.revenue),
      bookingCount: Number(totals.bookingCount),
      avgBookingValue: Math.round(Number(totals.avgBookingValue)),
    },
    bySource: bySource.map((r) => ({
      source: r.source,
      revenue: Number(r.revenue),
      count: Number(r.count),
    })),
    byCategory: byCategory.map((r) => ({
      category: r.category,
      revenue: Number(r.revenue),
      count: Number(r.count),
    })),
    byMethod: byMethod.map((r) => ({
      method: r.method,
      revenue: Number(r.revenue),
      count: Number(r.count),
    })),
    byTier: byTier.map((r) => ({
      tier: r.tier,
      revenue: Number(r.revenue),
      count: Number(r.count),
    })),
    dailyTrend: dailyTrend.map((r) => ({
      date: r.date,
      revenue: Number(r.revenue),
      count: Number(r.count),
    })),
  }, 200);
});

// Overview KPIs
app.get("/overview", async (c) => {
  // Pending payments count
  const [pendingPayments] = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(sql`${payments.status} = 'pending'`);

  // Payout queue total (pending payouts)
  const [payoutQueue] = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
    })
    .from(providerPayouts)
    .where(sql`${providerPayouts.status} = 'pending'`);

  // Active bookings (confirmed, dispatched, in_progress)
  const [activeBookings] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(bookings)
    .where(sql`${bookings.status} IN ('confirmed', 'dispatched', 'in_progress')`);

  // Online providers
  const [onlineProviders] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(providers)
    .where(and(
      eq(providers.isAvailable, true),
      eq(providers.status, "active"),
    ));

  return c.json({
    pendingPayments: {
      count: Number(pendingPayments.count),
      total: Number(pendingPayments.total),
    },
    payoutQueue: {
      count: Number(payoutQueue.count),
      total: Number(payoutQueue.total),
    },
    activeBookings: Number(activeBookings.count),
    onlineProviders: Number(onlineProviders.count),
  }, 200);
});

export default app;
