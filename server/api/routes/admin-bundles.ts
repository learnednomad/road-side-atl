import { Hono } from "hono";
import { db } from "@/db";
import { serviceBundles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { createServiceBundleSchema } from "@/lib/validators";

type AuthEnv = { Variables: { user: { id: string; role: string } } };
const app = new Hono<AuthEnv>();
app.use("/*", requireAdmin);

// GET / — all bundles (incl. inactive)
app.get("/", async (c) => {
  const rows = await db.select().from(serviceBundles).orderBy(desc(serviceBundles.createdAt));
  return c.json({ data: rows });
});

// POST / — create a bundle
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createServiceBundleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  try {
    const [bundle] = await db
      .insert(serviceBundles)
      .values({
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        serviceIds: parsed.data.serviceIds,
        bundlePrice: parsed.data.bundlePrice,
        savingsAmount: parsed.data.savingsAmount,
        active: parsed.data.active ?? true,
      })
      .returning();
    return c.json(bundle, 201);
  } catch {
    return c.json({ error: "A bundle with that slug already exists" }, 409);
  }
});

// DELETE /:id — deactivate a bundle
app.delete("/:id", async (c) => {
  const [updated] = await db
    .update(serviceBundles)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(serviceBundles.id, c.req.param("id")))
    .returning();
  if (!updated) return c.json({ error: "Bundle not found" }, 404);
  return c.json({ success: true });
});

export default app;
