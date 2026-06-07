import { Hono } from "hono";
import { db } from "@/db";
import { membershipPlans } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { createMembershipPlanSchema } from "@/lib/validators";

type AuthEnv = { Variables: { user: { id: string; role: string } } };
const app = new Hono<AuthEnv>();
app.use("/*", requireAdmin);

app.get("/", async (c) => {
  const rows = await db.select().from(membershipPlans).orderBy(desc(membershipPlans.createdAt));
  return c.json({ data: rows });
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createMembershipPlanSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  try {
    const [plan] = await db.insert(membershipPlans).values({
      name: parsed.data.name,
      slug: parsed.data.slug,
      priceCents: parsed.data.priceCents,
      interval: parsed.data.interval ?? "month",
      discountBp: parsed.data.discountBp,
      priorityDispatch: parsed.data.priorityDispatch ?? false,
      stripePriceId: parsed.data.stripePriceId,
      active: parsed.data.active ?? true,
    }).returning();
    return c.json(plan, 201);
  } catch {
    return c.json({ error: "A plan with that slug already exists" }, 409);
  }
});

app.delete("/:id", async (c) => {
  const [updated] = await db
    .update(membershipPlans)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(membershipPlans.id, c.req.param("id")))
    .returning();
  if (!updated) return c.json({ error: "Plan not found" }, 404);
  return c.json({ success: true });
});

export default app;
