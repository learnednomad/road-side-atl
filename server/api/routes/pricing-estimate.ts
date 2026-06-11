import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { calculateBookingPrice } from "@/server/api/lib/pricing-engine";
import { rateLimitStrict } from "../middleware/rate-limit";

const app = new Hono();

const pricingEstimateQuerySchema = z.object({
  serviceId: z.string().uuid("Invalid service ID"),
  scheduledAt: z.string().datetime().optional(),
  // Optional location — unlocks zone/weather pricing when those flags are on.
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

app.use("/", rateLimitStrict);

app.get("/", async (c) => {
  const serviceId = c.req.query("serviceId");
  const scheduledAt = c.req.query("scheduledAt");
  const lat = c.req.query("lat");
  const lng = c.req.query("lng");

  const parsed = pricingEstimateQuerySchema.safeParse({ serviceId, scheduledAt, lat, lng });
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, parsed.data.serviceId),
  });
  if (!service) {
    return c.json({ error: "Service not found" }, 404);
  }

  const hasLocation = parsed.data.lat !== undefined && parsed.data.lng !== undefined;
  const pricing = await calculateBookingPrice(
    parsed.data.serviceId,
    parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    hasLocation ? { location: { latitude: parsed.data.lat, longitude: parsed.data.lng } } : undefined,
  );

  return c.json(pricing);
});

export default app;
