import { Hono } from "hono";
import { db } from "@/db";
import { bookings, services, providers, reviews } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { generateCSV } from "@/lib/csv";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAuth);

// Get customer's bookings
app.get("/bookings", async (c) => {
  const user = c.get("user");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  const [{ total }] = await db
    .select({ total: count() })
    .from(bookings)
    .where(eq(bookings.userId, user.id));

  const customerBookings = await db
    .select({
      booking: bookings,
      service: services,
      provider: providers,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .where(eq(bookings.userId, user.id))
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset(offset);

  // Check which bookings have reviews
  const existingReviews = await db
    .select({ bookingId: reviews.bookingId })
    .from(reviews)
    .where(eq(reviews.customerId, user.id));

  const reviewedBookingIds = new Set(existingReviews.map((r) => r.bookingId));

  const formattedBookings = customerBookings.map(({ booking, service, provider }) => ({
    id: booking.id,
    status: booking.status,
    serviceName: service?.name || "Unknown Service",
    vehicleInfo: booking.vehicleInfo,
    location: booking.location,
    estimatedPrice: booking.estimatedPrice,
    finalPrice: booking.finalPrice,
    createdAt: booking.createdAt.toISOString(),
    scheduledAt: booking.scheduledAt?.toISOString() || null,
    providerName: provider?.name || null,
    hasReview: reviewedBookingIds.has(booking.id),
  }));

  return c.json({
    bookings: formattedBookings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Export customer bookings as CSV
app.get("/bookings/export", async (c) => {
  const user = c.get("user");

  const customerBookings = await db
    .select({
      booking: bookings,
      service: services,
      provider: providers,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .where(eq(bookings.userId, user.id))
    .orderBy(desc(bookings.createdAt));

  const headers = [
    "Booking ID",
    "Date",
    "Status",
    "Service",
    "Vehicle",
    "Location",
    "Provider",
    "Estimated Price",
    "Final Price",
  ];

  const rows = customerBookings.map(({ booking, service, provider }) => [
    booking.id.slice(0, 8),
    booking.createdAt.toLocaleDateString(),
    booking.status,
    service?.name || "Unknown",
    `${booking.vehicleInfo.year} ${booking.vehicleInfo.make} ${booking.vehicleInfo.model}`,
    booking.location.address,
    provider?.name || "N/A",
    `$${(booking.estimatedPrice / 100).toFixed(2)}`,
    booking.finalPrice ? `$${(booking.finalPrice / 100).toFixed(2)}` : "N/A",
  ]);

  const csv = generateCSV(headers, rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="my-bookings-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
});

// Get single booking detail
app.get("/bookings/:id", async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking || booking.userId !== user.id) {
    return c.json({ error: "Booking not found" }, 404);
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  let provider = null;
  if (booking.providerId) {
    provider = await db.query.providers.findFirst({
      where: eq(providers.id, booking.providerId),
    });
  }

  const review = await db.query.reviews.findFirst({
    where: eq(reviews.bookingId, bookingId),
  });

  return c.json({
    booking: {
      ...booking,
      createdAt: booking.createdAt.toISOString(),
      scheduledAt: booking.scheduledAt?.toISOString() || null,
      updatedAt: booking.updatedAt.toISOString(),
    },
    service,
    provider: provider
      ? {
          id: provider.id,
          name: provider.name,
          phone: provider.phone,
          averageRating: provider.averageRating,
          reviewCount: provider.reviewCount,
        }
      : null,
    hasReview: !!review,
  });
});

export default app;
