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
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";

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

export default app;
