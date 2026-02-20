import { db } from "@/db";
import { bookings, payments, providers, services, invoices, b2bAccounts } from "@/db/schema";
import type { InvoiceLineItem } from "@/db/schema/invoices";
import { eq, and, sql, isNull } from "drizzle-orm";
import { TOWING_PRICE_PER_MILE_CENTS, TOWING_BASE_MILES, B2B_INVOICE_DUE_DAYS } from "@/lib/constants";
import type { B2bPaymentTerms } from "@/lib/constants";

/**
 * Generate next invoice number using a PostgreSQL sequence for atomic generation.
 * Format: INV-YYYY-XXXXX
 */
export async function generateInvoiceNumber(): Promise<string> {
  // Create sequence if it doesn't exist
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1
  `);

  const [result] = await db.execute(sql`
    SELECT nextval('invoice_number_seq') as num
  `);

  const num = Number((result as { num: string }).num);
  const year = new Date().getFullYear();
  const padded = String(num).padStart(5, "0");
  return `INV-${year}-${padded}`;
}

/**
 * Create an invoice for a completed booking with confirmed payment.
 * Returns the created invoice or null if conditions not met.
 */
export async function createInvoiceForBooking(bookingId: string) {
  // Check if invoice already exists for this booking
  const existing = await db.query.invoices.findFirst({
    where: eq(invoices.bookingId, bookingId),
  });
  if (existing) return existing;

  // Get booking
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });
  if (!booking || booking.status !== "completed") return null;

  // Get confirmed payment
  const payment = await db.query.payments.findFirst({
    where: and(
      eq(payments.bookingId, bookingId),
      eq(payments.status, "confirmed")
    ),
  });
  if (!payment) return null;

  // Get service
  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });
  if (!service) return null;

  // Get provider if assigned
  let provider = null;
  if (booking.providerId) {
    provider = await db.query.providers.findFirst({
      where: eq(providers.id, booking.providerId),
    });
  }

  // Build line items
  const lineItems: InvoiceLineItem[] = [
    {
      description: service.name,
      quantity: 1,
      unitPrice: service.basePrice,
      total: service.basePrice,
    },
  ];

  // Add towing mileage surcharge if applicable
  if (booking.towingMiles && booking.towingMiles > TOWING_BASE_MILES) {
    const extraMiles = booking.towingMiles - TOWING_BASE_MILES;
    const mileageCost = extraMiles * TOWING_PRICE_PER_MILE_CENTS;
    lineItems.push({
      description: `Towing mileage surcharge (${extraMiles} extra miles @ $${(TOWING_PRICE_PER_MILE_CENTS / 100).toFixed(2)}/mi)`,
      quantity: extraMiles,
      unitPrice: TOWING_PRICE_PER_MILE_CENTS,
      total: mileageCost,
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const total = payment.amount; // Use actual payment amount as total

  const invoiceNumber = await generateInvoiceNumber();

  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber,
      bookingId,
      paymentId: payment.id,
      customerName: booking.contactName,
      customerEmail: booking.contactEmail,
      customerPhone: booking.contactPhone,
      lineItems,
      subtotal,
      total,
      status: "issued",
      providerId: provider?.id || null,
      providerName: provider?.name || null,
      issuedAt: new Date(),
      paidAt: payment.confirmedAt || new Date(),
    })
    .returning();

  return invoice;
}

/**
 * Create a B2B monthly invoice aggregating all completed bookings for a billing period.
 * Returns the created invoice or null if no uninvoiced bookings exist in the period.
 */
export async function createB2bMonthlyInvoice(
  accountId: string,
  billingPeriodStart: string,
  billingPeriodEnd: string,
) {
  const account = await db.query.b2bAccounts.findFirst({
    where: eq(b2bAccounts.id, accountId),
  });
  if (!account) return null;

  // Prevent duplicate invoices for the same billing period
  const existingInvoice = await db.query.invoices.findFirst({
    where: and(
      eq(invoices.tenantId, accountId),
      eq(invoices.billingPeriodStart, billingPeriodStart),
      eq(invoices.billingPeriodEnd, billingPeriodEnd),
    ),
  });
  if (existingInvoice) return null;

  // Find completed bookings for this B2B account in the billing period
  // that don't already have an invoice
  const completedBookings = await db
    .select({
      booking: bookings,
      service: services,
    })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .leftJoin(invoices, eq(invoices.bookingId, bookings.id))
    .where(
      and(
        eq(bookings.tenantId, accountId),
        eq(bookings.status, "completed"),
        sql`${bookings.updatedAt} >= ${billingPeriodStart}`,
        sql`${bookings.updatedAt} <= ${billingPeriodEnd}`,
        isNull(invoices.id),
      ),
    );

  if (completedBookings.length === 0) return null;

  // Build line items — one per booking
  const lineItems: InvoiceLineItem[] = completedBookings.map((row) => {
    const amount = row.booking.finalPrice || row.booking.estimatedPrice;
    const bookingDate = row.booking.updatedAt
      ? row.booking.updatedAt.toISOString().split("T")[0]
      : row.booking.createdAt.toISOString().split("T")[0];
    return {
      description: `${row.service.name} — ${bookingDate}`,
      quantity: 1,
      unitPrice: amount,
      total: amount,
    };
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal;

  // Calculate due date from payment terms
  const dueDays = B2B_INVOICE_DUE_DAYS[account.paymentTerms as B2bPaymentTerms] ?? 30;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const invoiceNumber = await generateInvoiceNumber();

  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber,
      customerName: account.contactName,
      customerEmail: account.contactEmail,
      customerPhone: account.contactPhone,
      lineItems,
      subtotal,
      total,
      status: "draft",
      tenantId: accountId,
      dueDate,
      billingPeriodStart,
      billingPeriodEnd,
    })
    .returning();

  return invoice;
}
