import { Hono } from "hono";
import { z } from "zod/v4";
import { requireAdmin } from "../middleware/auth";
import { rateLimitStandard } from "../middleware/rate-limit";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import {
  getAllFeatureFlags,
  isFeatureEnabled,
  setFeatureFlag,
  FEATURE_FLAGS,
  type FeatureFlagKey,
} from "../lib/feature-flags";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", rateLimitStandard);
app.use("/*", requireAdmin);

const validFlagKeys = new Set(Object.values(FEATURE_FLAGS));

// ── GET /admin/feature-flags — list all flags ────────────────────

app.get("/", async (c) => {
  const flags = await getAllFeatureFlags();
  return c.json({ flags });
});

// ── GET /admin/feature-flags/:key — get single flag ──────────────

app.get("/:key", async (c) => {
  const key = c.req.param("key");
  const flagKey = `feature:${key}` as FeatureFlagKey;

  if (!validFlagKeys.has(flagKey)) {
    return c.json({ error: "Unknown feature flag" }, 404);
  }

  const enabled = await isFeatureEnabled(flagKey);
  return c.json({ key: flagKey, enabled });
});

// ── PUT /admin/feature-flags/:key — toggle a flag ────────────────

const toggleSchema = z.object({
  enabled: z.boolean(),
});

app.put("/:key", async (c) => {
  const key = c.req.param("key");
  const flagKey = `feature:${key}` as FeatureFlagKey;

  if (!validFlagKeys.has(flagKey)) {
    return c.json({ error: "Unknown feature flag" }, 404);
  }

  const body = await c.req.json();
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input — expected { enabled: boolean }" }, 400);
  }

  const user = c.get("user");
  await setFeatureFlag(flagKey, parsed.data.enabled);

  logAudit({
    action: "settings.update",
    userId: user.id,
    resourceType: "feature_flag",
    resourceId: flagKey,
    details: { enabled: parsed.data.enabled },
    ...getRequestInfo(c.req.raw),
  });

  return c.json({ key: flagKey, enabled: parsed.data.enabled });
});

export default app;
