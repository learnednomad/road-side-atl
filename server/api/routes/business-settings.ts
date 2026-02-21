import { Hono } from "hono";
import { db } from "@/db";
import { businessSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { businessSettingsSchema } from "@/lib/validators";

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

// GET / - anyone authenticated
app.get("/", requireAuth, async (c) => {
  const [settings] = await db.select().from(businessSettings).limit(1);
  return c.json(settings || null);
});

// PUT / - admin only, upsert
app.put("/", requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = businessSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid input", details: parsed.error.issues },
      400
    );
  }

  const data = parsed.data;
  const [existing] = await db.select().from(businessSettings).limit(1);

  const values = {
    companyName: data.companyName,
    companyAddress: data.companyAddress || null,
    companyPhone: data.companyPhone || null,
    companyEmail: data.companyEmail || null,
    logoUrl: data.logoUrl || null,
    bankName: data.bankName || null,
    bankAccountName: data.bankAccountName || null,
    bankAccountNumber: data.bankAccountNumber || null,
    bankRoutingNumber: data.bankRoutingNumber || null,
    bankSwiftCode: data.bankSwiftCode || null,
    defaultPaymentTerms: data.defaultPaymentTerms || null,
    defaultPaymentMethod: data.defaultPaymentMethod || null,
    defaultPaymentInstructions: data.defaultPaymentInstructions || null,
    invoicePrefix: data.invoicePrefix || "INV",
    defaultTaxRate: data.defaultTaxRate ?? 0,
    invoiceFooterNote: data.invoiceFooterNote || null,
  };

  if (existing) {
    const [updated] = await db
      .update(businessSettings)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(businessSettings.id, existing.id))
      .returning();
    return c.json(updated);
  }

  const [created] = await db
    .insert(businessSettings)
    .values(values)
    .returning();

  return c.json(created, 201);
});

export default app;
