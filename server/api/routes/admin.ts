import { Hono } from "hono";
import { db } from "@/db";
import { bookings, services, payments, users } from "@/db/schema";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { updateBookingStatusSchema, confirmPaymentSchema } from "@/lib/validators";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);

// Dashboard stats
app.get("/stats", async (c) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayBookings] = await db
    .select({ count: count() })
    .from(bookings)
    .where(gte(bookings.createdAt, todayStart));

  const [pendingBookings] = await db
    .select({ count: count() })
    .from(bookings)
    .where(eq(bookings.status, "pending"));

  const [weeklyRevenue] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.status, "confirmed"), gte(payments.createdAt, weekStart)));

  const [monthlyRevenue] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(
      and(eq(payments.status, "confirmed"), gte(payments.createdAt, monthStart))
    );

  return c.json({
    todayBookings: todayBookings.count,
    pendingBookings: pendingBookings.count,
    weeklyRevenue: weeklyRevenue.total,
    monthlyRevenue: monthlyRevenue.total,
  });
});

// All bookings (filterable)
app.get("/bookings", async (c) => {
  const status = c.req.query("status");
  const serviceType = c.req.query("serviceType");

  let query = db
    .select({
      booking: bookings,
      service: services,
      payment: payments,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .orderBy(desc(bookings.createdAt))
    .$dynamic();

  const conditions = [];
  if (status) {
    conditions.push(eq(bookings.status, status as any));
  }
  if (serviceType) {
    conditions.push(eq(services.category, serviceType as any));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query;

  // Group payments by booking
  const bookingMap = new Map<
    string,
    { booking: any; service: any; payments: any[] }
  >();
  for (const row of results) {
    const existing = bookingMap.get(row.booking.id);
    if (existing) {
      if (row.payment) existing.payments.push(row.payment);
    } else {
      bookingMap.set(row.booking.id, {
        booking: row.booking,
        service: row.service,
        payments: row.payment ? [row.payment] : [],
      });
    }
  }

  return c.json(Array.from(bookingMap.values()));
});

// Update booking status
app.patch("/bookings/:id/status", async (c) => {
  const bookingId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateBookingStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  if (!updated) {
    return c.json({ error: "Booking not found" }, 404);
  }

  return c.json(updated);
});

// Confirm payment (cash/cashapp/zelle)
app.patch("/payments/:id/confirm", async (c) => {
  const paymentId = c.req.param("id");
  const body = await c.req.json();
  const parsed = confirmPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const user = c.get("user");

  // Check if payment exists, otherwise create one for the booking
  const existingPayment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
  });

  if (existingPayment) {
    const [updated] = await db
      .update(payments)
      .set({
        status: "confirmed",
        method: parsed.data.method,
        confirmedAt: new Date(),
        confirmedBy: user.id,
      })
      .where(eq(payments.id, paymentId))
      .returning();
    return c.json(updated);
  }

  return c.json({ error: "Payment not found" }, 404);
});

// Confirm payment by booking ID (for bookings without a payment record yet)
app.post("/bookings/:id/confirm-payment", async (c) => {
  const bookingId = c.req.param("id");
  const body = await c.req.json();
  const parsed = confirmPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const user = c.get("user");

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });
  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }

  const amount = parsed.data.amount || booking.estimatedPrice;

  const [payment] = await db
    .insert(payments)
    .values({
      bookingId,
      amount,
      method: parsed.data.method,
      status: "confirmed",
      confirmedAt: new Date(),
      confirmedBy: user.id,
    })
    .returning();

  // Update final price on booking
  await db
    .update(bookings)
    .set({ finalPrice: amount, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));

  return c.json(payment, 201);
});

// Revenue summary
app.get("/revenue", async (c) => {
  const confirmedPayments = await db
    .select({
      method: payments.method,
      total: sql<number>`sum(${payments.amount})`,
      count: count(),
    })
    .from(payments)
    .where(eq(payments.status, "confirmed"))
    .groupBy(payments.method);

  const byService = await db
    .select({
      serviceName: services.name,
      total: sql<number>`sum(${payments.amount})`,
      count: count(),
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(payments.status, "confirmed"))
    .groupBy(services.name);

  return c.json({ byMethod: confirmedPayments, byService });
});

// Customer list
app.get("/customers", async (c) => {
  const customers = await db
    .select({
      user: users,
      bookingCount: count(bookings.id),
      totalSpent: sql<number>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(users)
    .leftJoin(bookings, eq(users.id, bookings.userId))
    .leftJoin(
      payments,
      and(eq(payments.bookingId, bookings.id), eq(payments.status, "confirmed"))
    )
    .where(eq(users.role, "customer"))
    .groupBy(users.id)
    .orderBy(desc(sql`count(${bookings.id})`));

  return c.json(customers);
});

export default app;
