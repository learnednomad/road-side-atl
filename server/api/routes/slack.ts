/**
 * Read-only Slack slash-command bot. Slack POSTs (x-www-form-urlencoded) to
 * /slack/commands. We verify the request signature (HMAC-SHA256 over
 * `v0:{ts}:{rawBody}` with SLACK_SIGNING_SECRET), enforce a user allowlist
 * (SLACK_ADMIN_USER_IDS), and answer read-only queries. No mutations here —
 * interactive actions are a later, separately-gated phase (6d).
 */
import { Hono } from "hono";
import crypto from "crypto";
import { db } from "@/db";
import { bookings, providers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isFeatureEnabled, FEATURE_FLAGS } from "../lib/feature-flags";
import { logAudit } from "../lib/audit-logger";

const app = new Hono();

function verifySlackSignature(signingSecret: string, ts: string, rawBody: string, signature: string): boolean {
  // Reject stale requests (>5 min) to prevent replay.
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;
  const base = `v0:${ts}:${rawBody}`;
  const expected = "v0=" + crypto.createHmac("sha256", signingSecret).update(base).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function ephemeral(text: string) {
  return { response_type: "ephemeral", text };
}

function isAllowed(userId: string): boolean {
  const allow = (process.env.SLACK_ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return allow.length === 0 || allow.includes(userId);
}

app.post("/commands", async (c) => {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return c.json({ error: "Slack bot not configured" }, 503);

  const rawBody = await c.req.text();
  const ts = c.req.header("x-slack-request-timestamp") ?? "";
  const sig = c.req.header("x-slack-signature") ?? "";
  if (!verifySlackSignature(signingSecret, ts, rawBody, sig)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const params = new URLSearchParams(rawBody);
  const userId = params.get("user_id") ?? "";
  const allow = (process.env.SLACK_ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.length > 0 && !allow.includes(userId)) {
    return c.json(ephemeral("Not authorized."));
  }

  const text = (params.get("text") ?? "").trim();
  const [cmd, arg] = text.split(/\s+/, 2);

  if (cmd === "booking" && arg) {
    const b = await db.query.bookings.findFirst({ where: eq(bookings.id, arg) });
    if (!b) return c.json(ephemeral(`Booking ${arg} not found.`));
    return c.json(
      ephemeral(
        `*Booking ${b.id.slice(0, 8)}* — ${b.status}\nContact: ${b.contactName}\nEstimated: $${(b.estimatedPrice / 100).toFixed(2)}`,
      ),
    );
  }

  return c.json(
    ephemeral("RoadSide GA bot (read-only). Usage:\n• `/rsga booking <id>` — booking status"),
  );
});

// POST /interactions — interactive (mutating) actions from Slack buttons.
// Gated behind SLACK_INTERACTIVE; signature-verified + allowlisted + audited.
// Actions are reversible admin ops (provider suspend/reinstate).
app.post("/interactions", async (c) => {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return c.json({ error: "Slack bot not configured" }, 503);

  const rawBody = await c.req.text();
  const ts = c.req.header("x-slack-request-timestamp") ?? "";
  const sig = c.req.header("x-slack-signature") ?? "";
  if (!verifySlackSignature(signingSecret, ts, rawBody, sig)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  if (!(await isFeatureEnabled(FEATURE_FLAGS.SLACK_INTERACTIVE))) {
    return c.json(ephemeral("Interactive actions are disabled."));
  }

  let payload: { user?: { id?: string }; actions?: { value?: string }[] };
  try {
    payload = JSON.parse(new URLSearchParams(rawBody).get("payload") ?? "{}");
  } catch {
    return c.json(ephemeral("Bad payload."));
  }
  const slackUserId = payload.user?.id ?? "";
  if (!isAllowed(slackUserId)) return c.json(ephemeral("Not authorized."));

  const [kind, id] = (payload.actions?.[0]?.value ?? "").split(":");
  if ((kind === "provider_suspend" || kind === "provider_reinstate") && id) {
    const newStatus = kind === "provider_suspend" ? "suspended" : "active";
    const [updated] = await db
      .update(providers)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(providers.id, id))
      .returning();
    if (!updated) return c.json(ephemeral(`Provider ${id} not found.`));
    logAudit({
      action: "provider.status_change",
      userId: null,
      resourceType: "provider",
      resourceId: id,
      details: { newStatus, via: "slack", slackUserId },
    });
    return c.json(ephemeral(`Provider *${updated.name}* → ${newStatus}.`));
  }

  return c.json(ephemeral("Unknown or unsupported action."));
});

export default app;
