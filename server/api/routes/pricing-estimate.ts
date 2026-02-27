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
});

app.use("/", rateLimitStrict);

app.get("/", async (c) => {
  const serviceId = c.req.query("serviceId");
  const scheduledAt = c.req.query("scheduledAt");

  const parsed = pricingEstimateQuerySchema.safeParse({ serviceId, scheduledAt });
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, parsed.data.serviceId),
  });
  if (!service) {
    return c.json({ error: "Service not found" }, 404);
  }

  const pricing = await calculateBookingPrice(
    parsed.data.serviceId,
    parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
  );

  return c.json(pricing);
});

export default app;
