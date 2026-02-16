import { Hono } from "hono";
import { requireAdmin } from "@/server/api/middleware/auth";
import { db } from "@/db";
import { timeBlockConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateTimeBlockConfigSchema } from "@/lib/validators";
import { logAudit, getRequestInfo } from "@/server/api/lib/audit-logger";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();
app.use("/*", requireAdmin);

// GET / - List all time-block configs
app.get("/", async (c) => {
  const configs = await db.query.timeBlockConfigs.findMany({
    orderBy: (t, { asc }) => [asc(t.priority), asc(t.name)],
  });
  return c.json(configs, 200);
});

// PUT /:id - Update a time-block config
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTimeBlockConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const [updated] = await db
    .update(timeBlockConfigs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(timeBlockConfigs.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Config not found" }, 404);
  }

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);
  logAudit({
    action: "pricing.update_block",
    userId: user.id,
    resourceType: "time_block_config",
    resourceId: id,
    details: { ...data },
    ipAddress,
    userAgent,
  });

  return c.json(updated, 200);
});

export default app;
