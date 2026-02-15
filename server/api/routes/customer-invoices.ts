import { Hono } from "hono";
import { db } from "@/db";
import { invoices, bookings } from "@/db/schema";
import { eq, desc, and, count, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { generateInvoiceHTML } from "@/lib/invoices/generate-invoice-html";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAuth);

// List customer's invoices
app.get("/", async (c) => {
  const user = c.get("user");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  // Get customer's booking IDs
  const customerBookings = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.userId, user.id));

  const bookingIds = customerBookings.map((b) => b.id);

  if (bookingIds.length === 0) {
    return c.json({ data: [], total: 0, page, limit, totalPages: 0 });
  }

  const [totalResult] = await db
    .select({ count: count() })
    .from(invoices)
    .where(inArray(invoices.bookingId, bookingIds));

  const results = await db
    .select()
    .from(invoices)
    .where(inArray(invoices.bookingId, bookingIds))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    data: results.map((inv) => ({
      ...inv,
      createdAt: inv.createdAt.toISOString(),
      issuedAt: inv.issuedAt?.toISOString() || null,
      paidAt: inv.paidAt?.toISOString() || null,
    })),
    total: totalResult.count,
    page,
    limit,
    totalPages: Math.ceil(totalResult.count / limit),
  });
});

// Get single invoice (scoped to customer)
app.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
  });

  if (!invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  // Verify the customer owns the booking
  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, invoice.bookingId), eq(bookings.userId, user.id)),
  });

  if (!booking) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  return c.json({
    ...invoice,
    createdAt: invoice.createdAt.toISOString(),
    issuedAt: invoice.issuedAt?.toISOString() || null,
    paidAt: invoice.paidAt?.toISOString() || null,
  });
});

// Invoice HTML for print/download
app.get("/:id/html", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
  });

  if (!invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  // Verify the customer owns the booking
  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, invoice.bookingId), eq(bookings.userId, user.id)),
  });

  if (!booking) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  const html = generateInvoiceHTML({
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    customerPhone: invoice.customerPhone,
    lineItems: invoice.lineItems,
    subtotal: invoice.subtotal,
    total: invoice.total,
    status: invoice.status,
    providerName: invoice.providerName,
    issuedAt: invoice.issuedAt?.toISOString() || null,
    paidAt: invoice.paidAt?.toISOString() || null,
    notes: invoice.notes,
    bookingId: invoice.bookingId,
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
});

export default app;
