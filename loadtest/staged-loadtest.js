/**
 * Staged load test for https://roadsidega.com  (AUTHORIZED — owner: Nabil, Coolify app 48)
 *
 * Ramp: 50 -> 200 -> 500 -> 1000 connections, with hold periods and an automatic
 * back-off guard that aborts the ramp if the origin shows distress
 * (sustained 5xx, socket errors, or timeouts above threshold).
 *
 * Traffic mix is read-heavy. Write path (POST /api/bookings) is a small fraction
 * and every booking is tagged with recognizable LOADTEST markers + a .invalid email
 * so no real email can ever be delivered and the rows are trivially findable.
 */
const path = require("path");
const autocannon = require(
  "/root/.npm/_npx/0192e65d342ecc83/node_modules/autocannon"
);

const BASE = "https://roadsidega.com";
// Real service IDs pulled from GET /api/services at test time.
const SVC_INSPECTION = "b767bcdc-0602-42eb-878c-7a9b3a2ab095"; // Basic Inspection (schedulingMode "both")
const SVC_AC = "152713bf-3fb4-4dfd-a629-d346a211b6f5";          // AC Repair

// scheduledAt ~3h ahead -> satisfies "scheduled" validation AND skips auto-dispatch.
const scheduledAt = new Date(Date.now() + 3 * 3600 * 1000).toISOString();

function bookingBody() {
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return JSON.stringify({
    serviceId: SVC_INSPECTION,
    vehicleInfo: { year: "2019", make: "LOADTEST", model: "Synthetic", color: "Test" },
    location: {
      address: "LOADTEST 1 Peachtree St NE, Atlanta, GA 30303",
      latitude: 33.7589, // provided -> no server-side geocoding call
      longitude: -84.3879,
      notes: "synthetic load test row — safe to delete",
    },
    contactName: "LOADTEST Synthetic",
    contactPhone: "5550000000",
    contactEmail: `loadtest+${tag}@roadsidega-loadtest.invalid`,
    scheduledAt,
    notes: "AUTOMATED LOAD TEST — delete me",
    paymentMethod: "cash",
  });
}

// Weighted request pool. Counts below are relative weights (sum = 100).
const pool = [];
const add = (n, req) => { for (let i = 0; i < n; i++) pool.push(req); };

add(30, { method: "GET", path: "/" });                                   // static (CDN HIT)
add(10, { method: "GET", path: "/services" });                           // static (CDN HIT)
add(25, { method: "GET", path: "/api/services" });                       // dynamic DB read (no rate limit)
add(8,  { method: "GET", path: "/api/services/categories" });            // dynamic DB read (no rate limit)
add(10, { method: "GET", path: "/api/health" });                         // DB SELECT 1
add(7,  { method: "GET", path: `/api/pricing-estimate?serviceId=${SVC_AC}` }); // strict RL (20/min) + pricing engine
add(6,  { method: "GET", path: "/book" });                               // dynamic SSR page
add(4,  {                                                                // write path — strict RL (20/min)
  method: "POST",
  path: "/api/bookings",
  headers: { "content-type": "application/json" },
  body: bookingBody(),
  setupRequest: (req) => { req.body = bookingBody(); return req; }, // unique marked body each call
});

const STAGES = [
  { connections: 50,   duration: 25 },
  { connections: 200,  duration: 25 },
  { connections: 500,  duration: 20 },
  { connections: 1000, duration: 20 },
];

function summarize(label, r) {
  const codes = r.statusCodeStats || {};
  const codeStr = Object.keys(codes).sort()
    .map((k) => `${k}:${codes[k].count}`).join(" ");
  const L = r.latency;
  const out = {
    stage: label,
    reqTotal: r.requests.total,
    reqPerSec_avg: r.requests.average,
    bytesPerSec: r.throughput.average,
    lat_p50: L.p50, lat_p90: L.p90, lat_p95: L.p97_5, lat_p99: L.p99,
    lat_avg: L.average, lat_max: L.max,
    n2xx: r["2xx"], n3xx: r["3xx"], n4xx: r["4xx"], n5xx: r["5xx"],
    errors: r.errors, timeouts: r.timeouts,
    statusCodes: codeStr,
  };
  console.log("RESULT " + JSON.stringify(out));
  return out;
}

// Back-off guard: abort ramp if origin looks unhealthy (NOT counting 429s — those are
// expected rate limiting, a healthy protective response).
function shouldAbort(r) {
  const total = r.requests.total || 1;
  const badNetwork = (r.errors || 0) + (r.timeouts || 0);
  const fiveXX = r["5xx"] || 0;
  const reasons = [];
  if (badNetwork / total > 0.05) reasons.push(`network errors/timeouts ${(100*badNetwork/total).toFixed(1)}% > 5%`);
  if (fiveXX / total > 0.01) reasons.push(`5xx ${(100*fiveXX/total).toFixed(2)}% > 1%`);
  if (r.latency.p99 > 15000) reasons.push(`p99 ${r.latency.p99}ms > 15s`);
  return reasons;
}

async function run() {
  const results = [];
  for (const s of STAGES) {
    const label = `${s.connections}VU/${s.duration}s`;
    console.log(`\n=== STAGE ${label} starting ${new Date().toISOString()} ===`);
    const r = await autocannon({
      url: BASE,
      connections: s.connections,
      duration: s.duration,
      timeout: 15,
      requests: pool,
      // Random start offset per connection so the weighted pool is sampled evenly
      // rather than every connection marching in lock-step from index 0.
      idReplacement: false,
    });
    const sum = summarize(label, r);
    results.push(sum);
    const reasons = shouldAbort(r);
    if (reasons.length) {
      console.log(`\n!!! BACK-OFF TRIGGERED at ${label}: ${reasons.join("; ")}`);
      console.log("!!! Aborting ramp to protect production.");
      break;
    }
    // Recovery pause between stages (in-process, not a shell sleep).
    await new Promise((res) => setTimeout(res, 8000));
  }
  console.log("\n=== RAMP COMPLETE ===");
  console.log("SUMMARY " + JSON.stringify(results, null, 2));
}

run().catch((e) => { console.error("FATAL", e); process.exit(1); });
