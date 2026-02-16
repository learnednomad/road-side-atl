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
import { calculateBookingPrice } from "@/server/api/lib/pricing-engine";
import { geocodeAddress } from "@/lib/geocoding";
import { notifyBookingCreated } from "@/lib/notifications";
import { broadcastToAdmins } from "@/server/websocket/broadcast";
import { rateLimitStrict } from "../middleware/rate-limit";
import { logAudit, getRequestInfo } from "../lib/audit-logger";

const app = new Hono();

// Rate limit booking creation to prevent abuse
app.use("/", rateLimitStrict);

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

  // Calculate price via centralized pricing engine
  const pricing = await calculateBookingPrice(
    data.serviceId,
    data.scheduledAt ? new Date(data.scheduledAt) : null,
  );
  let estimatedPrice = pricing.finalPrice;
  let towingMiles: number | undefined;

  // Towing per-mile is ADDITIVE (not multiplied by time-block)
  if (service.slug === "towing" && data.location.estimatedMiles) {
    towingMiles = data.location.estimatedMiles;
    const extraMiles = Math.max(0, towingMiles - TOWING_BASE_MILES);
    estimatedPrice += extraMiles * TOWING_PRICE_PER_MILE_CENTS;
  }

  // Get user if logged in
  const session = await auth();
  const userId = session?.user?.id || null;

  // Server-side geocoding fallback if no coordinates provided
  const locationData = { ...data.location };
  if (!locationData.latitude || !locationData.longitude) {
    const geocoded = await geocodeAddress(locationData.address).catch(() => null);
    if (geocoded) {
      locationData.latitude = geocoded.latitude;
      locationData.longitude = geocoded.longitude;
      locationData.placeId = geocoded.placeId;
    }
  }
  if (locationData.destination && !locationData.destinationLatitude) {
    const geocoded = await geocodeAddress(locationData.destination).catch(() => null);
    if (geocoded) {
      locationData.destinationLatitude = geocoded.latitude;
      locationData.destinationLongitude = geocoded.longitude;
    }
  }

  const [booking] = await db
    .insert(bookings)
    .values({
      userId,
      serviceId: data.serviceId,
      vehicleInfo: data.vehicleInfo,
      location: locationData,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      estimatedPrice,
      towingMiles,
      notes: data.notes,
      preferredPaymentMethod: data.paymentMethod,
    })
    .returning();

  // Audit log the booking creation
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "booking.create",
    userId: userId || undefined,
    resourceType: "booking",
    resourceId: booking.id,
    details: {
      serviceName: service.name,
      contactEmail: data.contactEmail,
      estimatedPrice,
    },
    ipAddress,
    userAgent,
  });

  // Fire-and-forget notifications + broadcast
  notifyBookingCreated(booking).catch(() => {});
  broadcastToAdmins({
    type: "booking:created",
    data: { bookingId: booking.id, contactName: booking.contactName, status: booking.status, serviceName: service.name },
  });

  return c.json({
    ...booking,
    pricingBreakdown: {
      basePrice: pricing.basePrice,
      multiplier: pricing.multiplier,
      blockName: pricing.blockName,
    },
  }, 201);
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

  // Audit log the cancellation
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "booking.cancel",
    userId: user.id,
    resourceType: "booking",
    resourceId: bookingId,
    details: { previousStatus: booking.status },
    ipAddress,
    userAgent,
  });

  return c.json(updated);
});

export default app;
