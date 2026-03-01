import { Hono } from "hono";
import { db } from "@/db";
import { invoices, providers } from "@/db/schema";
import { eq, desc, and, or, ilike, count } from "drizzle-orm";
import { requireProvider } from "../middleware/auth";
import { createStandaloneInvoiceSchema, updateInvoiceStatusSchema } from "@/lib/validators";
import { generateInvoiceNumber } from "../lib/invoice-generator";
import { generateInvoiceHTML } from "@/lib/invoices/generate-invoice-html";
import { logAudit, getRequestInfo } from "../lib/audit-logger";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireProvider);

// Helper to get provider for current user
async function getProvider(userId: string) {
  return db.query.providers.findFirst({
    where: eq(providers.userId, userId),
  });
}

// List provider's invoices
app.get("/", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const search = c.req.query("search");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const provider = await getProvider(user.id);
  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const conditions = [eq(invoices.providerId, provider.id)];

  if (status) {
    conditions.push(eq(invoices.status, status as any));
  }

  if (search) {
    conditions.push(
      or(
        ilike(invoices.customerName, `%${search}%`),
        ilike(invoices.invoiceNumber, `%${search}%`)
      )!
    );
  }

  const whereClause = and(...conditions);

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

// Create standalone invoice
app.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createStandaloneInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const provider = await getProvider(user.id);
  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const { customerName, customerEmail, customerPhone, lineItems: rawLineItems, notes } = parsed.data;

  // Compute totals server-side
  const lineItems = rawLineItems.map((item) => ({
    ...item,
    total: item.quantity * item.unitPrice,
  }));
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal;

  const invoiceNumber = await generateInvoiceNumber();

  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber,
      bookingId: null,
      customerName,
      customerEmail,
      customerPhone,
      lineItems,
      subtotal,
      total,
      status: "draft",
      providerId: provider.id,
      providerName: provider.name,
      notes: notes || null,
    })
    .returning();

  logAudit({
    action: "invoice.create_standalone",
    userId: user.id,
    resourceType: "invoice",
    resourceId: invoice.id,
    details: { invoiceNumber, customerName, total },
    ...getRequestInfo(c.req.raw),
  });

  return c.json({
    ...invoice,
    createdAt: invoice.createdAt.toISOString(),
    issuedAt: invoice.issuedAt?.toISOString() || null,
    paidAt: invoice.paidAt?.toISOString() || null,
  }, 201);
});

// Get single invoice (scoped to provider)
app.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const provider = await getProvider(user.id);
  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.providerId, provider.id)),
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

// Update standalone invoice status (issue/void)
app.patch("/:id/status", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateInvoiceStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid status" }, 400);
  }

  const provider = await getProvider(user.id);
  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.providerId, provider.id)),
  });

  if (!invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  // Only allow status changes on standalone invoices
  if (invoice.bookingId) {
    return c.json({ error: "Cannot modify platform invoice status" }, 403);
  }

  // Providers can only set issued or void
  if (parsed.data.status !== "issued" && parsed.data.status !== "void") {
    return c.json({ error: "Providers can only issue or void invoices" }, 403);
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

  logAudit({
    action: parsed.data.status === "void" ? "invoice.void" : "invoice.issue",
    userId: user.id,
    resourceType: "invoice",
    resourceId: id,
    details: { invoiceNumber: invoice.invoiceNumber, newStatus: parsed.data.status },
    ...getRequestInfo(c.req.raw),
  });

  return c.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    issuedAt: updated.issuedAt?.toISOString() || null,
    paidAt: updated.paidAt?.toISOString() || null,
  });
});

// Invoice HTML for print (scoped to provider)
app.get("/:id/html", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const provider = await getProvider(user.id);
  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.providerId, provider.id)),
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
