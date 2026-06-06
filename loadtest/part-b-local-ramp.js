/**
 * Part B — LOCAL staged load ramp against the dockerized build (http://localhost:3001)
 * with TRUST_PROXY=true. Every request carries a RANDOM X-Forwarded-For drawn from a
 * large pool (simulating many distinct real clients), so the per-IP rate limiter behaves
 * as it would in production. Goal: confirm the global shared-bucket 429 storm is gone —
 * distinct IPs are NOT collectively throttled.
 *
 * NOTE: local box is 8 vCPU shared with the app container + a Coolify prod stack + this
 * load generator, so absolute throughput is NOT comparable to the prod baseline.
 */
const autocannon = require("/root/.npm/_npx/0192e65d342ecc83/node_modules/autocannon");

const BASE = "http://localhost:3001";
const SVC_AC = "6ea7efd0-d640-4eef-bdf4-88c4eb16a83c";        // AC Repair (seeded)
const SVC_INSP = "f06617ef-c88f-4a0d-9b79-f85db8a34e2c";      // Basic Inspection (seeded)

function randIp() {
  // ~16M-IP pool so a given IP almost never repeats inside a 60s/20-req window.
  return `10.${(Math.random()*256)|0}.${(Math.random()*256)|0}.${((Math.random()*254)|0)+1}`;
}

// Read-heavy mix. pricing-estimate is the STRICT (20/60s) rate-limited endpoint — the one
// that previously caused the shared-bucket self-DoS. Write path (POST /api/bookings) is
// intentionally excluded here to avoid mass row creation; its strict per-IP behavior was
// already proven in Part A.
const pool = [];
const add = (n, req) => { for (let i = 0; i < n; i++) pool.push({ ...req }); };
add(30, { method: "GET", path: "/" });                                          // static
add(25, { method: "GET", path: "/api/services" });                             // dynamic DB read, no RL
add(20, { method: "GET", path: `/api/pricing-estimate?serviceId=${SVC_AC}` }); // STRICT RL + pricing engine
add(8,  { method: "GET", path: `/api/pricing-estimate?serviceId=${SVC_INSP}` });// STRICT RL (2nd service)
add(10, { method: "GET", path: "/api/health" });                               // DB SELECT 1
add(7,  { method: "GET", path: "/book" });                                     // SSR page

// Stamp a fresh random XFF on every single request.
for (const r of pool) {
  r.setupRequest = (req) => {
    req.headers = { ...(req.headers || {}), "x-forwarded-for": randIp(), "accept-encoding": "gzip" };
    return req;
  };
}

const STAGES = [
  { connections: 50,  duration: 20 },
  { connections: 200, duration: 20 },
  { connections: 500, duration: 20 },
];

function summarize(label, r) {
  const codes = r.statusCodeStats || {};
  const codeStr = Object.keys(codes).sort().map((k) => `${k}:${codes[k].count}`).join(" ");
  const L = r.latency;
  const out = {
    stage: label,
    reqTotal: r.requests.total,
    rps_avg: r.requests.average,
    p50: L.p50, p95: L.p97_5, p99: L.p99, max: L.max,
    n2xx: r["2xx"], n4xx: r["4xx"], n5xx: r["5xx"],
    errors: r.errors, timeouts: r.timeouts,
    statusCodes: codeStr,
  };
  console.log("RESULT " + JSON.stringify(out));
  return out;
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
    });
    results.push(summarize(label, r));
    await new Promise((res) => setTimeout(res, 5000));
  }
  console.log("\nSUMMARY " + JSON.stringify(results, null, 2));
}
run().catch((e) => { console.error("FATAL", e); process.exit(1); });
