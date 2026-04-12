import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "@/db";
import { serviceBundles, services } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { rateLimitStandard } from "../middleware/rate-limit";
import { logAudit, getRequestInfo } from "../lib/audit-logger";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();
app.use("/*", rateLimitStandard);
app.use("/*", requireAdmin);

const createBundleSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  serviceIds: z.array(z.string()).min(2),
  bundlePrice: z.number().int().min(100), // cents, min $1
});

// GET /admin/bundles — list all bundles with service details
app.get("/", async (c) => {
  const bundles = await db.query.serviceBundles.findMany({
    orderBy: (b, { desc }) => [desc(b.createdAt)],
  });

  // Enrich with service names
  const allServiceIds = bundles.flatMap((b) => b.serviceIds);
  const serviceList = allServiceIds.length > 0
    ? await db.query.services.findMany({
        where: inArray(services.id, allServiceIds),
        columns: { id: true, name: true, basePrice: true },
      })
    : [];
  const serviceMap = new Map(serviceList.map((s) => [s.id, s]));

  return c.json({
    bundles: bundles.map((b) => ({
      ...b,
      services: b.serviceIds.map((id) => serviceMap.get(id) ?? { id, name: "Unknown", basePrice: 0 }),
    })),
  });
});

// POST /admin/bundles — create a new bundle
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createBundleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const user = c.get("user");
  const { name, slug, description, serviceIds, bundlePrice } = parsed.data;

  // Validate all service IDs exist
  const existingServices = await db.query.services.findMany({
    where: inArray(services.id, serviceIds),
    columns: { id: true, basePrice: true },
  });

  if (existingServices.length !== serviceIds.length) {
    return c.json({ error: "One or more service IDs are invalid" }, 400);
  }

  // Calculate savings
  const individualTotal = existingServices.reduce((sum, s) => sum + s.basePrice, 0);
  const savingsAmount = Math.max(0, individualTotal - bundlePrice);

  const [bundle] = await db
    .insert(serviceBundles)
    .values({
      name,
      slug,
      description: description ?? null,
      serviceIds,
      bundlePrice,
      savingsAmount,
    })
    .returning();

  logAudit({
    action: "settings.update",
    userId: user.id,
    resourceType: "service_bundle",
    resourceId: bundle!.id,
    details: { name, slug, bundlePrice, serviceCount: serviceIds.length, savingsAmount },
    ...getRequestInfo(c.req.raw),
  });

  return c.json(bundle, 201);
});

// PUT /admin/bundles/:id — update a bundle
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const existing = await db.query.serviceBundles.findFirst({
    where: eq(serviceBundles.id, id),
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json();
  const parsed = createBundleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.slug) updates.slug = parsed.data.slug;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.bundlePrice) updates.bundlePrice = parsed.data.bundlePrice;
  if (parsed.data.serviceIds) updates.serviceIds = parsed.data.serviceIds;

  const [updated] = await db
    .update(serviceBundles)
    .set(updates)
    .where(eq(serviceBundles.id, id))
    .returning();

  logAudit({
    action: "settings.update",
    userId: user.id,
    resourceType: "service_bundle",
    resourceId: id,
    details: { updates: Object.keys(updates) },
    ...getRequestInfo(c.req.raw),
  });

  return c.json(updated);
});

// DELETE /admin/bundles/:id — deactivate a bundle
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  await db
    .update(serviceBundles)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(serviceBundles.id, id));

  logAudit({
    action: "settings.update",
    userId: user.id,
    resourceType: "service_bundle",
    resourceId: id,
    details: { action: "deactivated" },
    ...getRequestInfo(c.req.raw),
  });

  return c.json({ ok: true });
});

// Public: GET /admin/bundles/active — active bundles for customer-facing use
app.get("/active", async (c) => {
  const bundles = await db.query.serviceBundles.findMany({
    where: eq(serviceBundles.active, true),
  });
  return c.json({ bundles });
});

export default app;
