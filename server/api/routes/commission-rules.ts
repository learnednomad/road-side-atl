import { Hono } from "hono";
import { db } from "@/db";
import { commissionRules } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { createCommissionRuleSchema } from "@/lib/validators";
import { logAudit, getRequestInfo } from "../lib/audit-logger";

type AuthEnv = { Variables: { user: { id: string; role: string } } };

const app = new Hono<AuthEnv>();
app.use("/*", requireAdmin);

// GET / — list commission rules (highest precedence first)
app.get("/", async (c) => {
  const rows = await db.select().from(commissionRules).orderBy(desc(commissionRules.priority));
  return c.json({ data: rows });
});

// POST / — create a commission rule
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createCommissionRuleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }
  const [rule] = await db
    .insert(commissionRules)
    .values({
      scope: parsed.data.scope,
      scopeId: parsed.data.scope === "global" ? null : parsed.data.scopeId,
      commissionRateBp: parsed.data.commissionRateBp,
      priority: parsed.data.priority ?? 0,
      notes: parsed.data.notes,
    })
    .returning();

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "commission_rule.created",
    userId: user.id,
    resourceType: "commission_rule",
    resourceId: rule.id,
    details: { scope: rule.scope, scopeId: rule.scopeId, commissionRateBp: rule.commissionRateBp },
    ipAddress,
    userAgent,
  });
  return c.json(rule, 201);
});

// DELETE /:id — remove a commission rule
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [deleted] = await db.delete(commissionRules).where(eq(commissionRules.id, id)).returning();
  if (!deleted) return c.json({ error: "Rule not found" }, 404);

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "commission_rule.deleted",
    userId: user.id,
    resourceType: "commission_rule",
    resourceId: id,
    details: { scope: deleted.scope, scopeId: deleted.scopeId },
    ipAddress,
    userAgent,
  });
  return c.json({ success: true });
});

export default app;
