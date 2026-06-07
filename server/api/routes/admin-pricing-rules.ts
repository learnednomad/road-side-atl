import { Hono } from "hono";
import { db } from "@/db";
import { pricingRules } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { createPricingRuleSchema } from "@/lib/validators";

type AuthEnv = { Variables: { user: { id: string; role: string } } };
const app = new Hono<AuthEnv>();
app.use("/*", requireAdmin);

app.get("/", async (c) => {
  const rows = await db.select().from(pricingRules).orderBy(desc(pricingRules.priority));
  return c.json({ data: rows });
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createPricingRuleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  const [rule] = await db
    .insert(pricingRules)
    .values({
      scope: parsed.data.scope,
      scopeId: parsed.data.scope === "global" ? null : parsed.data.scopeId,
      multiplierBp: parsed.data.multiplierBp,
      priority: parsed.data.priority ?? 0,
      notes: parsed.data.notes,
    })
    .returning();
  return c.json(rule, 201);
});

app.delete("/:id", async (c) => {
  const [updated] = await db
    .update(pricingRules)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(pricingRules.id, c.req.param("id")))
    .returning();
  if (!updated) return c.json({ error: "Rule not found" }, 404);
  return c.json({ success: true });
});

export default app;
