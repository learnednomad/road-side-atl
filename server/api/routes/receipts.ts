import { Hono } from "hono";
import { db } from "@/db";
import { bookings, services, providers, payments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateReceiptHTML } from "@/lib/receipts/generate-receipt";

const app = new Hono();

// GET /api/receipts/:bookingId - Get receipt HTML for a booking
app.get("/:bookingId", async (c) => {
  const bookingId = c.req.param("bookingId");

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }

  // Get confirmed payment
  const payment = await db.query.payments.findFirst({
    where: and(
      eq(payments.bookingId, bookingId),
      eq(payments.status, "confirmed")
    ),
  });

  if (!payment) {
    return c.json({ error: "No confirmed payment found for this booking" }, 400);
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

  const receiptData = {
    bookingId: booking.id,
    serviceName: service?.name || "Service",
    customerName: booking.contactName,
    customerEmail: booking.contactEmail,
    customerPhone: booking.contactPhone,
    vehicleInfo: booking.vehicleInfo,
    location: {
      address: booking.location.address,
      destination: booking.location.destination,
    },
    estimatedPrice: booking.estimatedPrice,
    finalPrice: booking.finalPrice || booking.estimatedPrice,
    paymentMethod: payment.method.charAt(0).toUpperCase() + payment.method.slice(1),
    paymentDate: payment.confirmedAt?.toISOString() || payment.createdAt.toISOString(),
    bookingDate: booking.createdAt.toISOString(),
    providerName: provider?.name,
    towingMiles: booking.towingMiles || undefined,
  };

  const html = generateReceiptHTML(receiptData);

  // Check if PDF requested
  const format = c.req.query("format");
  if (format === "pdf") {
    // For PDF, we'll return HTML that can be printed to PDF client-side
    // A proper PDF would require puppeteer or similar which is heavy for serverless
    return c.html(html);
  }

  return c.html(html);
});

// GET /api/receipts/:bookingId/download - Download receipt as file
app.get("/:bookingId/download", async (c) => {
  const bookingId = c.req.param("bookingId");

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }

  const payment = await db.query.payments.findFirst({
    where: and(
      eq(payments.bookingId, bookingId),
      eq(payments.status, "confirmed")
    ),
  });

  if (!payment) {
    return c.json({ error: "No confirmed payment found" }, 400);
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

  const receiptData = {
    bookingId: booking.id,
    serviceName: service?.name || "Service",
    customerName: booking.contactName,
    customerEmail: booking.contactEmail,
    customerPhone: booking.contactPhone,
    vehicleInfo: booking.vehicleInfo,
    location: {
      address: booking.location.address,
      destination: booking.location.destination,
    },
    estimatedPrice: booking.estimatedPrice,
    finalPrice: booking.finalPrice || booking.estimatedPrice,
    paymentMethod: payment.method.charAt(0).toUpperCase() + payment.method.slice(1),
    paymentDate: payment.confirmedAt?.toISOString() || payment.createdAt.toISOString(),
    bookingDate: booking.createdAt.toISOString(),
    providerName: provider?.name,
    towingMiles: booking.towingMiles || undefined,
  };

  const html = generateReceiptHTML(receiptData);

  c.header("Content-Type", "text/html");
  c.header("Content-Disposition", `attachment; filename="receipt-${bookingId.slice(0, 8)}.html"`);

  return c.body(html);
});

export default app;
