import { Hono } from "hono";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, desc, sql, count, and, ilike, or, isNull, isNotNull } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { generateInvoiceSchema, updateInvoiceStatusSchema } from "@/lib/validators";
import type { InvoiceStatus } from "@/lib/constants";
import { createInvoiceForBooking } from "../lib/invoice-generator";
import { generateInvoiceHTML } from "@/lib/invoices/generate-invoice-html";
import { generateCSV } from "@/lib/csv";
import { logAudit, getRequestInfo } from "../lib/audit-logger";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAdmin);

// List invoices with filters and pagination
app.get("/", async (c) => {
  const status = c.req.query("status");
  const type = c.req.query("type");
  const search = c.req.query("search");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const conditions = [];

  if (status) {
    conditions.push(eq(invoices.status, status as InvoiceStatus));
  }
  if (type === "standalone") {
    conditions.push(isNull(invoices.bookingId));
  } else if (type === "platform") {
    conditions.push(isNotNull(invoices.bookingId));
  }
  if (search) {
    conditions.push(
      or(
        ilike(invoices.invoiceNumber, `%${search}%`),
        ilike(invoices.customerName, `%${search}%`),
        ilike(invoices.customerEmail, `%${search}%`)
      )!
    );
  }
  if (startDate) {
    conditions.push(sql`${invoices.createdAt} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${invoices.createdAt} <= ${endDate}`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(invoices)
    .where(whereClause);

  const results = await db
    .select()
    .from(invoices)
    .where(whereClause)
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset);

  // Summary counts
  const [summary] = await db
    .select({
      totalInvoiced: sql<number>`coalesce(sum(${invoices.total}), 0)`,
      issuedCount: sql<number>`count(case when ${invoices.status} = 'issued' then 1 end)`,
      paidCount: sql<number>`count(case when ${invoices.status} = 'paid' then 1 end)`,
      voidCount: sql<number>`count(case when ${invoices.status} = 'void' then 1 end)`,
    })
    .from(invoices);

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
    summary: {
      totalInvoiced: Number(summary.totalInvoiced),
      issuedCount: Number(summary.issuedCount),
      paidCount: Number(summary.paidCount),
      voidCount: Number(summary.voidCount),
    },
  });
});

// CSV export (must be before /:id to avoid param capture)
app.get("/export", async (c) => {
  const status = c.req.query("status");
  const exportType = c.req.query("type");
  const conditions = [];
  if (status) {
    conditions.push(eq(invoices.status, status as InvoiceStatus));
  }
  if (exportType === "standalone") {
    conditions.push(isNull(invoices.bookingId));
  } else if (exportType === "platform") {
    conditions.push(isNotNull(invoices.bookingId));
  }

  const results = await db
    .select()
    .from(invoices)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invoices.createdAt));

  const headers = [
    "Invoice #",
    "Customer",
    "Email",
    "Amount",
    "Status",
    "Type",
    "Provider",
    "Issued Date",
    "Paid Date",
    "Created",
  ];

  const rows = results.map((inv) => [
    inv.invoiceNumber,
    inv.customerName,
    inv.customerEmail,
    `$${(inv.total / 100).toFixed(2)}`,
    inv.status,
    inv.bookingId ? "Platform" : "Standalone",
    inv.providerName || "N/A",
    inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "",
    inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "",
    new Date(inv.createdAt).toLocaleDateString(),
  ]);

  const csv = generateCSV(headers, rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
});

// Get single invoice
app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
  });

  if (!invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  return c.json({
    ...invoice,
    createdAt: invoice.createdAt.toISOString(),
    issuedAt: invoice.issuedAt?.toISOString() || null,
    paidAt: invoice.paidAt?.toISOString() || null,
  });
});

// Generate invoice manually from booking
app.post("/generate", async (c) => {
  const body = await c.req.json();
  const parsed = generateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const invoice = await createInvoiceForBooking(parsed.data.bookingId);
  if (!invoice) {
    return c.json({ error: "Cannot generate invoice: booking must be completed with confirmed payment" }, 400);
  }

  const user = c.get("user");
  logAudit({
    action: "invoice.generate",
    userId: user.id,
    resourceType: "invoice",
    resourceId: invoice.id,
    details: { invoiceNumber: invoice.invoiceNumber, bookingId: parsed.data.bookingId },
    ...getRequestInfo(c.req.raw),
  });

  return c.json(invoice, 201);
});

// Update invoice status (issue/void)
app.patch("/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateInvoiceStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
  });
  if (!invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  const updates: { status: "issued" | "void"; issuedAt?: Date } = { status: parsed.data.status };
  if (parsed.data.status === "issued" && !invoice.issuedAt) {
    updates.issuedAt = new Date();
  }

  const [updated] = await db
    .update(invoices)
    .set(updates)
    .where(eq(invoices.id, id))
    .returning();

  const user = c.get("user");
  logAudit({
    action: parsed.data.status === "void" ? "invoice.void" : "invoice.issue",
    userId: user.id,
    resourceType: "invoice",
    resourceId: id,
    details: { invoiceNumber: invoice.invoiceNumber, newStatus: parsed.data.status },
    ...getRequestInfo(c.req.raw),
  });

  return c.json(updated);
});

// Invoice HTML for print
app.get("/:id/html", async (c) => {
  const id = c.req.param("id");

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
  });

  if (!invoice) {
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
