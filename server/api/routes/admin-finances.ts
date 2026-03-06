import { Hono } from "hono";
import { db } from "@/db";
import { payments, providerPayouts } from "@/db/schema";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);

// Financial summary KPIs
app.get("/summary", async (c) => {
  // Total revenue (confirmed payments)
  const [revenue] = await db
    .select({
      totalRevenue: sql<number>`coalesce(sum(case when ${payments.status} = 'confirmed' then ${payments.amount} else 0 end), 0)`,
      confirmedCount: sql<number>`count(case when ${payments.status} = 'confirmed' then 1 end)`,
      refundedCount: sql<number>`count(case when ${payments.status} = 'refunded' then 1 end)`,
      totalCount: sql<number>`count(*)`,
    })
    .from(payments);

  // Total payouts
  const [payoutSummary] = await db
    .select({
      totalPayouts: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
      pendingPayouts: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'pending' then ${providerPayouts.amount} else 0 end), 0)`,
    })
    .from(providerPayouts);

  // Outstanding (pending) payments
  const [outstanding] = await db
    .select({
      outstandingAmount: sql<number>`coalesce(sum(case when ${payments.status} = 'pending' then ${payments.amount} else 0 end), 0)`,
      outstandingCount: sql<number>`count(case when ${payments.status} = 'pending' then 1 end)`,
    })
    .from(payments);

  const totalRevenue = Number(revenue.totalRevenue);
  const totalPayouts = Number(payoutSummary.totalPayouts);
  const platformProfit = totalRevenue - totalPayouts;
  const confirmedCount = Number(revenue.confirmedCount);
  const refundedCount = Number(revenue.refundedCount);
  const totalCount = Number(revenue.totalCount);

  return c.json({
    totalRevenue,
    totalPayouts,
    platformProfit,
    profitMargin: totalRevenue > 0 ? Math.round((platformProfit / totalRevenue) * 10000) / 100 : 0,
    outstandingPayments: Number(outstanding.outstandingAmount),
    outstandingCount: Number(outstanding.outstandingCount),
    pendingPayouts: Number(payoutSummary.pendingPayouts),
    refundRate: totalCount > 0 ? Math.round((refundedCount / totalCount) * 10000) / 100 : 0,
    avgRevenuePerJob: confirmedCount > 0 ? Math.round(totalRevenue / confirmedCount) : 0,
    avgProfitPerJob: confirmedCount > 0 ? Math.round(platformProfit / confirmedCount) : 0,
  });
});

// Payment aging buckets
app.get("/aging", async (c) => {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [aging] = await db
    .select({
      bucket_0_7_amount: sql<number>`coalesce(sum(case when ${payments.status} = 'pending' and ${payments.createdAt} >= ${d7} then ${payments.amount} else 0 end), 0)`,
      bucket_0_7_count: sql<number>`count(case when ${payments.status} = 'pending' and ${payments.createdAt} >= ${d7} then 1 end)`,
      bucket_8_14_amount: sql<number>`coalesce(sum(case when ${payments.status} = 'pending' and ${payments.createdAt} < ${d7} and ${payments.createdAt} >= ${d14} then ${payments.amount} else 0 end), 0)`,
      bucket_8_14_count: sql<number>`count(case when ${payments.status} = 'pending' and ${payments.createdAt} < ${d7} and ${payments.createdAt} >= ${d14} then 1 end)`,
      bucket_15_30_amount: sql<number>`coalesce(sum(case when ${payments.status} = 'pending' and ${payments.createdAt} < ${d14} and ${payments.createdAt} >= ${d30} then ${payments.amount} else 0 end), 0)`,
      bucket_15_30_count: sql<number>`count(case when ${payments.status} = 'pending' and ${payments.createdAt} < ${d14} and ${payments.createdAt} >= ${d30} then 1 end)`,
      bucket_30_plus_amount: sql<number>`coalesce(sum(case when ${payments.status} = 'pending' and ${payments.createdAt} < ${d30} then ${payments.amount} else 0 end), 0)`,
      bucket_30_plus_count: sql<number>`count(case when ${payments.status} = 'pending' and ${payments.createdAt} < ${d30} then 1 end)`,
    })
    .from(payments);

  return c.json({
    buckets: [
      { label: "0-7 days", amount: Number(aging.bucket_0_7_amount), count: Number(aging.bucket_0_7_count) },
      { label: "8-14 days", amount: Number(aging.bucket_8_14_amount), count: Number(aging.bucket_8_14_count) },
      { label: "15-30 days", amount: Number(aging.bucket_15_30_amount), count: Number(aging.bucket_15_30_count) },
      { label: "30+ days", amount: Number(aging.bucket_30_plus_amount), count: Number(aging.bucket_30_plus_count) },
    ],
  });
});

// Monthly trends
app.get("/trends", async (c) => {
  const months = parseInt(c.req.query("months") || "12");
  const limitMonths = Math.min(Math.max(months, 1), 24);

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - limitMonths);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  // Monthly revenue
  const revenueByMonth = await db
    .select({
      month: sql<string>`to_char(${payments.createdAt}, 'YYYY-MM')`,
      revenue: sql<number>`coalesce(sum(case when ${payments.status} = 'confirmed' then ${payments.amount} else 0 end), 0)`,
      jobCount: sql<number>`count(case when ${payments.status} = 'confirmed' then 1 end)`,
    })
    .from(payments)
    .where(sql`${payments.createdAt} >= ${startDate.toISOString()}`)
    .groupBy(sql`to_char(${payments.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${payments.createdAt}, 'YYYY-MM')`);

  // Monthly payouts
  const payoutsByMonth = await db
    .select({
      month: sql<string>`to_char(${providerPayouts.createdAt}, 'YYYY-MM')`,
      payouts: sql<number>`coalesce(sum(${providerPayouts.amount}), 0)`,
    })
    .from(providerPayouts)
    .where(sql`${providerPayouts.createdAt} >= ${startDate.toISOString()}`)
    .groupBy(sql`to_char(${providerPayouts.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${providerPayouts.createdAt}, 'YYYY-MM')`);

  // Build combined monthly data
  const payoutMap = new Map(payoutsByMonth.map((p) => [p.month, Number(p.payouts)]));

  const trends = revenueByMonth.map((r) => {
    const revenue = Number(r.revenue);
    const payouts = payoutMap.get(r.month) || 0;
    const profit = revenue - payouts;
    return {
      month: r.month,
      revenue,
      payouts,
      profit,
      profitMargin: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
      jobCount: Number(r.jobCount),
    };
  });

  return c.json({ trends });
});

export default app;
