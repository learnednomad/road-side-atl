import { Hono } from "hono";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { PRICING_SCENARIOS } from "@/lib/pricing-scenarios";

const serviceCategoryFilterSchema = z.object({
  category: z.enum(["roadside", "diagnostics", "mechanics"]).optional(),
});

const app = new Hono();

// GET /services?category=mechanics — list active services, optionally filtered
app.get("/", async (c) => {
  const parsed = serviceCategoryFilterSchema.safeParse({
    category: c.req.query("category") || undefined,
  });

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { category } = parsed.data;

  const conditions = [eq(services.active, true)];
  if (category) {
    conditions.push(eq(services.category, category));
  }

  const allServices = await db
    .select()
    .from(services)
    .where(and(...conditions))
    .orderBy(services.name);

  return c.json(allServices);
});

// GET /services/categories — aggregate counts by category
app.get("/categories", async (c) => {
  const categories = await db
    .select({
      category: services.category,
      count: sql<number>`count(*)::int`,
    })
    .from(services)
    .where(eq(services.active, true))
    .groupBy(services.category);

  return c.json(categories);
});

// GET /services/scenarios — 5 Atlanta scenario budgets with suggested service IDs
// (e.g. "moderate catch-up" → battery, brake, alignment service rows)
app.get("/scenarios", async (c) => {
  const allSlugs = Array.from(
    new Set(PRICING_SCENARIOS.flatMap((s) => s.serviceSlugs))
  );

  const matched = await db
    .select({ id: services.id, slug: services.slug, name: services.name })
    .from(services)
    .where(and(eq(services.active, true), inArray(services.slug, allSlugs)));

  const bySlug = new Map(matched.map((r) => [r.slug, r]));

  return c.json(
    PRICING_SCENARIOS.map((s) => ({
      key: s.key,
      label: s.label,
      description: s.description,
      budgetMinCents: s.budgetMinCents,
      budgetMaxCents: s.budgetMaxCents,
      services: s.serviceSlugs
        .map((slug) => bySlug.get(slug))
        .filter((r): r is { id: string; slug: string; name: string } => Boolean(r)),
    }))
  );
});

export default app;
