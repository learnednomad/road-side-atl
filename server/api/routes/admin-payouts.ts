import { Hono } from "hono";
import { db } from "@/db";
import { providerPayouts, providers, bookings } from "@/db/schema";
import { eq, desc, sql, count, and, inArray } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { markPayoutPaidSchema } from "@/lib/validators";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);

// List payouts with filters
app.get("/", async (c) => {
  const status = c.req.query("status");
  const providerId = c.req.query("providerId");

  const conditions = [];
  if (status) {
    conditions.push(eq(providerPayouts.status, status as any));
  }
  if (providerId) {
    conditions.push(eq(providerPayouts.providerId, providerId));
  }

  let query = db
    .select({
      payout: providerPayouts,
      provider: providers,
      booking: bookings,
    })
    .from(providerPayouts)
    .innerJoin(providers, eq(providerPayouts.providerId, providers.id))
    .innerJoin(bookings, eq(providerPayouts.bookingId, bookings.id))
    .orderBy(desc(providerPayouts.createdAt))
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query;
  return c.json(results);
});

// Batch mark payouts as paid
app.post("/mark-paid", async (c) => {
  const body = await c.req.json();
  const parsed = markPayoutPaidSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const now = new Date();
  const updated = await db
    .update(providerPayouts)
    .set({ status: "paid", paidAt: now })
    .where(
      and(
        inArray(providerPayouts.id, parsed.data.payoutIds),
        eq(providerPayouts.status, "pending")
      )
    )
    .returning();

  return c.json({ updated: updated.length, payouts: updated });
});

// Aggregate summary
app.get("/summary", async (c) => {
  const [summary] = await db
    .select({
      totalPending: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'pending' then ${providerPayouts.amount} else 0 end), 0)`,
      totalPaid: sql<number>`coalesce(sum(case when ${providerPayouts.status} = 'paid' then ${providerPayouts.amount} else 0 end), 0)`,
      pendingCount: sql<number>`count(case when ${providerPayouts.status} = 'pending' then 1 end)`,
      paidCount: sql<number>`count(case when ${providerPayouts.status} = 'paid' then 1 end)`,
    })
    .from(providerPayouts);

  return c.json({
    totalPending: Number(summary.totalPending),
    totalPaid: Number(summary.totalPaid),
    pendingCount: Number(summary.pendingCount),
    paidCount: Number(summary.paidCount),
  });
});

export default app;
