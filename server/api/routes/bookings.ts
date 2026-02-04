import { Hono } from "hono";
import { db } from "@/db";
import { bookings, services, payments } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireAuth } from "../middleware/auth";
import { createBookingSchema } from "@/lib/validators";
import {
  TOWING_BASE_MILES,
  TOWING_PRICE_PER_MILE_CENTS,
} from "@/lib/constants";

const app = new Hono();

// Create booking (guest or authenticated)
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const data = parsed.data;

  // Look up service
  const service = await db.query.services.findFirst({
    where: eq(services.id, data.serviceId),
  });
  if (!service) {
    return c.json({ error: "Service not found" }, 404);
  }

  // Calculate price
  let estimatedPrice = service.basePrice;
  let towingMiles: number | undefined;

  if (service.slug === "towing" && data.location.estimatedMiles) {
    towingMiles = data.location.estimatedMiles;
    const extraMiles = Math.max(0, towingMiles - TOWING_BASE_MILES);
    estimatedPrice += extraMiles * TOWING_PRICE_PER_MILE_CENTS;
  }

  // Get user if logged in
  const session = await auth();
  const userId = session?.user?.id || null;

  const [booking] = await db
    .insert(bookings)
    .values({
      userId,
      serviceId: data.serviceId,
      vehicleInfo: data.vehicleInfo,
      location: data.location,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      estimatedPrice,
      towingMiles,
      notes: data.notes,
    })
    .returning();

  return c.json(booking, 201);
});

// Get user's bookings (authenticated)
app.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  const userBookings = await db
    .select({
      booking: bookings,
      service: services,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.userId, user.id))
    .orderBy(desc(bookings.createdAt));

  return c.json(userBookings);
});

// Get single booking
app.get("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.userId, user.id)),
  });

  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
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

// Cancel booking
app.patch("/:id/cancel", requireAuth, async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.userId, user.id)),
  });

  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }

  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return c.json({ error: "Cannot cancel this booking" }, 400);
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  return c.json(updated);
});

export default app;
