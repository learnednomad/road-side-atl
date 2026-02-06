import { Hono } from "hono";
import { geocodeAddress } from "@/lib/geocoding";

const app = new Hono();

app.post("/address", async (c) => {
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
