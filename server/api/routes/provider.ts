import { Hono } from "hono";
import { db } from "@/db";
import { bookings, services, providers, payments } from "@/db/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { requireProvider } from "../middleware/auth";
import { updateBookingStatusSchema } from "@/lib/validators";
import { notifyStatusChange } from "@/lib/notifications";
import { broadcastToAdmins, broadcastToUser } from "@/server/websocket/broadcast";
import { autoDispatchBooking } from "../lib/auto-dispatch";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireProvider);

// Get provider's assigned jobs
app.get("/jobs", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  // Find provider record linked to this user
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const conditions = [eq(bookings.providerId, provider.id)];
  if (status) {
    conditions.push(eq(bookings.status, status as any));
  }

  const [totalResult] = await db
    .select({ count: count() })
    .from(bookings)
    .where(and(...conditions));

  const jobs = await db
    .select({
      booking: bookings,
      service: services,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(and(...conditions))
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    data: jobs,
    total: totalResult.count,
    page,
    limit,
    totalPages: Math.ceil(totalResult.count / limit),
    providerId: provider.id,
  });
});

// Get single job detail
app.get("/jobs/:id", async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)),
  });

  if (!booking) {
    return c.json({ error: "Job not found" }, 404);
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  const bookingPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, bookingId));

  return c.json({ booking, service, payments: bookingPayments });
});

// Accept assignment
app.patch("/jobs/:id/accept", async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)),
  });

  if (!booking) {
    return c.json({ error: "Job not found" }, 404);
  }

  if (booking.status !== "dispatched" && booking.status !== "confirmed") {
    return c.json({ error: "Job cannot be accepted in current status" }, 400);
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  // Fire-and-forget notifications
  notifyStatusChange(booking, "in_progress").catch(() => {});
  broadcastToAdmins({ type: "booking:status_changed", data: { bookingId, status: "in_progress" } });
  if (booking.userId) {
    broadcastToUser(booking.userId, { type: "booking:status_changed", data: { bookingId, status: "in_progress" } });
  }

  return c.json(updated);
});

// Reject assignment (unassign, trigger re-dispatch)
app.patch("/jobs/:id/reject", async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)),
  });

  if (!booking) {
    return c.json({ error: "Job not found" }, 404);
  }

  // Unassign provider and revert to confirmed
  const [updated] = await db
    .update(bookings)
    .set({ providerId: null, status: "confirmed", updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  // Try to re-dispatch
  autoDispatchBooking(bookingId).catch(() => {});

  broadcastToAdmins({ type: "booking:status_changed", data: { bookingId, status: "confirmed" } });

  return c.json(updated);
});

// Update job status
app.patch("/jobs/:id/status", async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateBookingStatusSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)),
  });

  if (!booking) {
    return c.json({ error: "Job not found" }, 404);
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  notifyStatusChange(booking, parsed.data.status).catch(() => {});
  broadcastToAdmins({ type: "booking:status_changed", data: { bookingId, status: parsed.data.status } });
  if (booking.userId) {
    broadcastToUser(booking.userId, { type: "booking:status_changed", data: { bookingId, status: parsed.data.status } });
  }

  return c.json(updated);
});

// Update current location
app.post("/location", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { latitude, longitude } = body;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return c.json({ error: "Invalid coordinates" }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  await db
    .update(providers)
    .set({
      currentLocation: { lat: latitude, lng: longitude, updatedAt: new Date().toISOString() },
      lastLocationUpdate: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(providers.id, provider.id));

  broadcastToAdmins({
    type: "provider:location_updated",
    data: { providerId: provider.id, lat: latitude, lng: longitude },
  });

  return c.json({ success: true });
});

// Provider stats
app.get("/stats", async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [todayJobs] = await db
    .select({ count: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.providerId, provider.id),
        eq(bookings.status, "completed"),
        sql`${bookings.updatedAt} >= ${todayStart.toISOString()}`
      )
    );

  const [weekEarnings] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .where(
      and(
        eq(bookings.providerId, provider.id),
        eq(payments.status, "confirmed"),
        sql`${payments.createdAt} >= ${weekStart.toISOString()}`
      )
    );

  const [totalCompleted] = await db
    .select({ count: count() })
    .from(bookings)
    .where(
      and(eq(bookings.providerId, provider.id), eq(bookings.status, "completed"))
    );

  return c.json({
    todayJobs: todayJobs.count,
    weekEarnings: Number(weekEarnings.total),
    totalCompleted: totalCompleted.count,
  });
});

// Get provider profile
app.get("/profile", async (c) => {
  const user = c.get("user");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  return c.json({
    id: provider.id,
    name: provider.name,
    email: provider.email,
    phone: provider.phone,
    address: provider.address,
    latitude: provider.latitude,
    longitude: provider.longitude,
    isAvailable: provider.isAvailable,
    commissionRate: provider.commissionRate,
    commissionType: provider.commissionType,
    flatFeeAmount: provider.flatFeeAmount,
    specialties: provider.specialties,
    status: provider.status,
  });
});

// Update provider profile
app.patch("/profile", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const updates: Partial<{
    name: string;
    phone: string;
    address: string;
    latitude: number;
    longitude: number;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (body.name && typeof body.name === "string") updates.name = body.name;
  if (body.phone && typeof body.phone === "string") updates.phone = body.phone;
  if (body.address && typeof body.address === "string") updates.address = body.address;
  if (typeof body.latitude === "number") updates.latitude = body.latitude;
  if (typeof body.longitude === "number") updates.longitude = body.longitude;

  const [updated] = await db
    .update(providers)
    .set(updates)
    .where(eq(providers.id, provider.id))
    .returning();

  return c.json(updated);
});

// Toggle availability
app.patch("/availability", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const isAvailable = body.isAvailable;

  if (typeof isAvailable !== "boolean") {
    return c.json({ error: "isAvailable must be a boolean" }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const [updated] = await db
    .update(providers)
    .set({ isAvailable, updatedAt: new Date() })
    .where(eq(providers.id, provider.id))
    .returning();

  return c.json(updated);
});

export default app;
