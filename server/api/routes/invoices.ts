import { Hono } from "hono";
import { db } from "@/db";
import {
  invoices,
  invoiceLineItems,
  businessSettings,
  users,
} from "@/db/schema";
import { eq, desc, and, or, ilike, count } from "drizzle-orm";
import { invoiceStatusEnum } from "@/db/schema/invoices";
import { requireAuth } from "../middleware/auth";
import { createInvoiceSchema, updateInvoiceSchema } from "@/lib/validators";
import { renderInvoicePdf } from "@/lib/invoice-pdf/render";

type AuthEnv = {
  Variables: {
    user: {
      id: string;
      role: string;
      name?: string | null;
      email?: string | null;
    };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAuth);

// Inline check: provider or admin
function isProviderOrAdmin(role: string) {
  return role === "provider" || role === "admin";
}

// Generate next invoice number
async function generateInvoiceNumber(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  const [latest] = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(ilike(invoices.invoiceNumber, pattern))
    .orderBy(desc(invoices.invoiceNumber))
    .limit(1);

  let nextNum = 1;
  if (latest) {
    const parts = latest.invoiceNumber.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  return `${prefix}-${year}-${String(nextNum).padStart(4, "0")}`;
}

// Calculate totals from line items
function calculateTotals(
  lineItems: { quantity: number; unitPrice: number }[],
  taxRate: number
) {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const taxAmount = Math.round((subtotal * taxRate) / 10000);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

// POST / - Create invoice
app.post("/", async (c) => {
  const user = c.get("user");
  if (!isProviderOrAdmin(user.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const data = parsed.data;

  // Get business settings for prefix and defaults
  const [settings] = await db.select().from(businessSettings).limit(1);
  const prefix = settings?.invoicePrefix || "INV";
  const taxRate = data.taxRate ?? settings?.defaultTaxRate ?? 0;

  const invoiceNumber = await generateInvoiceNumber(prefix);
  const { subtotal, taxAmount, total } = calculateTotals(
    data.lineItems,
    taxRate
  );

  // If saveCustomer and no customerId, create a new user
  let customerId = data.customerId || null;
  if (data.saveCustomer && !customerId && data.customerEmail) {
    const [newUser] = await db
      .insert(users)
      .values({
        name: data.customerName,
        email: data.customerEmail,
        phone: data.customerPhone || null,
        role: "customer",
      })
      .onConflictDoNothing()
      .returning();
    if (newUser) customerId = newUser.id;
  }

  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber,
      createdById: user.id,
      customerId,
      customerName: data.customerName,
      customerEmail: data.customerEmail || null,
      customerPhone: data.customerPhone || null,
      customerCompany: data.customerCompany || null,
      customerAddress: data.customerAddress || null,
      issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      subtotal,
      taxRate,
      taxAmount,
      total,
      paymentTerms:
        data.paymentTerms || settings?.defaultPaymentTerms || null,
      paymentMethod:
        data.paymentMethod || settings?.defaultPaymentMethod || null,
      paymentInstructions:
        data.paymentInstructions ||
        settings?.defaultPaymentInstructions ||
        null,
      notes: data.notes || null,
    })
    .returning();

  // Insert line items
  const lineItemValues = data.lineItems.map((item, index) => ({
    invoiceId: invoice.id,
    description: item.description,
    details: item.details || null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.quantity * item.unitPrice,
    sortOrder: index,
  }));

  const items = await db
    .insert(invoiceLineItems)
    .values(lineItemValues)
    .returning();

  return c.json({ ...invoice, lineItems: items }, 201);
});

// GET / - List invoices
app.get("/", async (c) => {
  const user = c.get("user");
  if (!isProviderOrAdmin(user.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const status = c.req.query("status");
  const search = c.req.query("search");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const conditions = [];

  // Providers see only their own invoices
  if (user.role === "provider") {
    conditions.push(eq(invoices.createdById, user.id));
  }

  if (status) {
    conditions.push(eq(invoices.status, status as (typeof invoiceStatusEnum.enumValues)[number]));
  }

  if (search) {
    conditions.push(
      or(
        ilike(invoices.customerName, `%${search}%`),
        ilike(invoices.invoiceNumber, `%${search}%`),
        ilike(invoices.customerEmail, `%${search}%`)
      )
    );
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

  return c.json({
    data: results,
    total: totalResult.count,
    page,
    limit,
    totalPages: Math.ceil(totalResult.count / limit),
  });
});

// GET /:id - Get invoice with line items
app.get("/:id", async (c) => {
  const user = c.get("user");
  if (!isProviderOrAdmin(user.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const id = c.req.param("id");

  const conditions = [eq(invoices.id, id)];
  if (user.role === "provider") {
    conditions.push(eq(invoices.createdById, user.id));
  }

  const invoice = await db.query.invoices.findFirst({
    where: and(...conditions),
  });

  if (!invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  const items = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, id))
    .orderBy(invoiceLineItems.sortOrder);

  return c.json({ ...invoice, lineItems: items });
});

// PATCH /:id - Update draft invoice
app.patch("/:id", async (c) => {
  const user = c.get("user");
  if (!isProviderOrAdmin(user.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const existing = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
  });

  if (!existing) return c.json({ error: "Invoice not found" }, 404);
  if (existing.status !== "draft")
    return c.json({ error: "Only draft invoices can be edited" }, 400);
  if (user.role === "provider" && existing.createdById !== user.id)
    return c.json({ error: "Forbidden" }, 403);

  const data = parsed.data;
  const taxRate = data.taxRate ?? existing.taxRate;

  let subtotal = existing.subtotal;
  let taxAmount = existing.taxAmount;
  let total = existing.total;

  // If line items provided, rebuild them
  if (data.lineItems && data.lineItems.length > 0) {
    await db
      .delete(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, id));

    const lineItemValues = data.lineItems.map((item, index) => ({
      invoiceId: id,
      description: item.description,
      details: item.details || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
      sortOrder: index,
    }));

    await db.insert(invoiceLineItems).values(lineItemValues);
    const totals = calculateTotals(data.lineItems, taxRate);
    subtotal = totals.subtotal;
    taxAmount = totals.taxAmount;
    total = totals.total;
  }

  const [updated] = await db
    .update(invoices)
    .set({
      ...(data.customerName && { customerName: data.customerName }),
      ...(data.customerEmail !== undefined && {
        customerEmail: data.customerEmail || null,
      }),
      ...(data.customerPhone !== undefined && {
        customerPhone: data.customerPhone || null,
      }),
      ...(data.customerCompany !== undefined && {
        customerCompany: data.customerCompany || null,
      }),
      ...(data.customerAddress !== undefined && {
        customerAddress: data.customerAddress || null,
      }),
      ...(data.issueDate && { issueDate: new Date(data.issueDate) }),
      ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
      ...(data.paymentTerms !== undefined && {
        paymentTerms: data.paymentTerms || null,
      }),
      ...(data.paymentMethod !== undefined && {
        paymentMethod: data.paymentMethod || null,
      }),
      ...(data.paymentInstructions !== undefined && {
        paymentInstructions: data.paymentInstructions || null,
      }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      taxRate,
      subtotal,
      taxAmount,
      total,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, id))
    .returning();

  const items = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, id))
    .orderBy(invoiceLineItems.sortOrder);

  return c.json({ ...updated, lineItems: items });
});

// DELETE /:id - Delete draft invoice
app.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!isProviderOrAdmin(user.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const id = c.req.param("id");
  const existing = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
  });

  if (!existing) return c.json({ error: "Invoice not found" }, 404);
  if (existing.status !== "draft")
    return c.json({ error: "Only draft invoices can be deleted" }, 400);
  if (user.role === "provider" && existing.createdById !== user.id)
    return c.json({ error: "Forbidden" }, 403);

  await db.delete(invoices).where(eq(invoices.id, id));
  return c.json({ success: true });
});

// POST /:id/send - Mark as sent
app.post("/:id/send", async (c) => {
  const user = c.get("user");
  if (!isProviderOrAdmin(user.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const id = c.req.param("id");
  const existing = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
  });

  if (!existing) return c.json({ error: "Invoice not found" }, 404);
  if (existing.status !== "draft")
    return c.json({ error: "Only draft invoices can be sent" }, 400);

  const [updated] = await db
    .update(invoices)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();

  return c.json(updated);
});

// PATCH /:id/status - Update status
app.patch("/:id/status", async (c) => {
  const user = c.get("user");
  if (!isProviderOrAdmin(user.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const id = c.req.param("id");
  const body = await c.req.json();
  const { status } = body;

  const validStatuses = ["paid", "overdue", "cancelled"];
  if (!validStatuses.includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const existing = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
  });
  if (!existing) return c.json({ error: "Invoice not found" }, 404);

  const [updated] = await db
    .update(invoices)
    .set({ status, updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();

  return c.json(updated);
});

// GET /:id/pdf - Generate PDF
app.get("/:id/pdf", async (c) => {
  const user = c.get("user");
  if (!isProviderOrAdmin(user.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const id = c.req.param("id");

  const conditions = [eq(invoices.id, id)];
  if (user.role === "provider") {
    conditions.push(eq(invoices.createdById, user.id));
  }

  const invoice = await db.query.invoices.findFirst({
    where: and(...conditions),
  });
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);

  const items = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, id))
    .orderBy(invoiceLineItems.sortOrder);

  const [settings] = await db.select().from(businessSettings).limit(1);

  const pdfBuffer = await renderInvoicePdf({
    invoice,
    lineItems: items,
    businessSettings: settings || null,
  });

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
});

export default app;
