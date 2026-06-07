/**
 * Next.js instrumentation hook — runs once when the server process starts, for
 * both the standalone production server (`node server.js`) and `next dev`.
 *
 * Production runs the Next standalone server, which does NOT execute
 * server-custom.ts, so background cron jobs (payouts, reconciliation, offer
 * expiry, etc.) would otherwise never start. We start them here. WebSocket
 * startup still lives in the custom server because it needs the HTTP `upgrade`
 * event, which the standalone server owns.
 */
export async function register() {
  // Only run in the Node.js server runtime — never on the edge runtime or at build.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Validate environment at boot. In production this fails closed (process.exit)
  // on missing required vars or placeholder secrets.
  await import("@/lib/env");

  // Start background cron only in production. In development, run the custom
  // server (server-custom.ts) if you need cron/WebSocket locally.
  if (process.env.NODE_ENV === "production") {
    const { startCronJobs } = await import("@/server/cron");
    startCronJobs();
  }
}
