import { Hono } from "hono";
import { requireAdmin } from "@/server/api/middleware/auth";
import { db } from "@/db";
import { timeBlockConfigs } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { updateTimeBlockConfigSchema, activateStormModeSchema } from "@/lib/validators";
import { logAudit, getRequestInfo } from "@/server/api/lib/audit-logger";
import { STORM_MODE_PRIORITY } from "@/lib/constants";
import { broadcastToAdmins } from "@/server/websocket/broadcast";

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

// GET /storm-mode/status - Get current storm mode status
app.get("/storm-mode/status", async (c) => {
  const activeStorm = await db.query.timeBlockConfigs.findFirst({
    where: and(
      eq(timeBlockConfigs.isActive, true),
      gte(timeBlockConfigs.priority, STORM_MODE_PRIORITY),
    ),
  });
  return c.json({
    active: !!activeStorm,
    template: activeStorm || null,
  }, 200);
});

// POST /storm-mode/activate - Activate a storm mode template
app.post("/storm-mode/activate", async (c) => {
  const body = await c.req.json();
  const parsed = activateStormModeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const { templateId } = parsed.data;

  // Verify template exists and is a storm template (priority >= 100)
  const template = await db.query.timeBlockConfigs.findFirst({
    where: and(
      eq(timeBlockConfigs.id, templateId),
      gte(timeBlockConfigs.priority, STORM_MODE_PRIORITY),
    ),
  });
  if (!template) {
    return c.json({ error: "Storm mode template not found" }, 404);
  }

  // Deactivate ALL + activate selected in a single transaction (mutual exclusivity)
  const [activated] = await db.transaction(async (tx) => {
    await tx
      .update(timeBlockConfigs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(gte(timeBlockConfigs.priority, STORM_MODE_PRIORITY));

    return tx
      .update(timeBlockConfigs)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(timeBlockConfigs.id, templateId))
      .returning();
  });

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "pricing.toggle_storm_mode",
    userId: user.id,
    resourceType: "time_block_config",
    resourceId: templateId,
    details: { action: "activate", templateName: template.name, multiplier: template.multiplier },
    ipAddress,
    userAgent,
  });

  broadcastToAdmins({
    type: "storm_mode:activated",
    data: { templateName: template.name, multiplier: template.multiplier, activatedBy: user.name || user.id },
  });

  return c.json(activated, 200);
});

// POST /storm-mode/deactivate - Deactivate all storm mode templates
app.post("/storm-mode/deactivate", async (c) => {
  await db
    .update(timeBlockConfigs)
    .set({ isActive: false, updatedAt: new Date() })
    .where(gte(timeBlockConfigs.priority, STORM_MODE_PRIORITY));

  const user = c.get("user");
  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "pricing.toggle_storm_mode",
    userId: user.id,
    resourceType: "time_block_config",
    details: { action: "deactivate_all" },
    ipAddress,
    userAgent,
  });

  broadcastToAdmins({
    type: "storm_mode:deactivated",
    data: { deactivatedBy: user.name || user.id },
  });

  return c.json({ success: true }, 200);
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
