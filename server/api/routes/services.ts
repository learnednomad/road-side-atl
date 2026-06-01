import { Hono } from "hono";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod/v4";

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

export default app;
