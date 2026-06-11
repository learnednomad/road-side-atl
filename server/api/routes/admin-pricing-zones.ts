import { Hono } from "hono";
import { db } from "@/db";
import { pricingZones } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { createPricingZoneSchema, updatePricingZoneSchema } from "@/lib/validators";

type AuthEnv = { Variables: { user: { id: string; role: string } } };
const app = new Hono<AuthEnv>();
app.use("/*", requireAdmin);

app.get("/", async (c) => {
  const rows = await db.select().from(pricingZones).orderBy(desc(pricingZones.createdAt));
  return c.json({ data: rows });
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createPricingZoneSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const [zone] = await db
    .insert(pricingZones)
    .values({
      name: parsed.data.name,
      polygon: parsed.data.polygon,
      baseMultiplierBp: parsed.data.baseMultiplierBp,
      active: parsed.data.active ?? true,
    })
    .returning();
  return c.json(zone, 201);
});

app.put("/:id", async (c) => {
  const body = await c.req.json();
  const parsed = updatePricingZoneSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const [updated] = await db
    .update(pricingZones)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(pricingZones.id, c.req.param("id")))
    .returning();
  if (!updated) return c.json({ error: "Zone not found" }, 404);
  return c.json(updated);
});

app.delete("/:id", async (c) => {
  const [updated] = await db
    .update(pricingZones)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(pricingZones.id, c.req.param("id")))
    .returning();
  if (!updated) return c.json({ error: "Zone not found" }, 404);
  return c.json({ success: true });
});

export default app;
