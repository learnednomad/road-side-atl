import { Hono } from "hono";
import { geocodeAddress } from "@/lib/geocoding";
import { rateLimitStrict } from "../middleware/rate-limit";

const app = new Hono();

// Rate-limited (not auth-gated) so guest booking can still geocode, but an
// anonymous loop can't run up the paid Google Maps bill (L3).
app.post("/address", rateLimitStrict, async (c) => {
  const body = await c.req.json();
  const address = body.address;

  if (!address || typeof address !== "string") {
    return c.json({ error: "Address is required" }, 400);
  }

  const result = await geocodeAddress(address);
  if (!result) {
    return c.json({ error: "Could not geocode address" }, 404);
  }

  return c.json(result);
});

export default app;
