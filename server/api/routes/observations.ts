import { Hono } from "hono";
import { db } from "@/db";
import { observations, bookings, providers, services } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { requireProvider } from "../middleware/auth";
import { createObservationSchema } from "@/lib/validators";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import { notifyObservationFollowUp } from "@/lib/notifications";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireProvider);

// Submit observation for a booking
app.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createObservationSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  // Verify booking exists and belongs to this provider
  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, parsed.data.bookingId), eq(bookings.providerId, provider.id)),
  });

  if (!booking) {
    return c.json({ error: "Booking not found or not assigned to you" }, 404);
  }

  // Check for duplicate observation on same booking
  const existing = await db.query.observations.findFirst({
    where: eq(observations.bookingId, parsed.data.bookingId),
  });

  if (existing) {
    return c.json({ error: "Observation already submitted for this booking" }, 409);
  }

  const [observation] = await db
    .insert(observations)
    .values({
      bookingId: parsed.data.bookingId,
      providerId: provider.id,
      items: parsed.data.items,
    })
    .returning();

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  logAudit({
    action: "observation.submit",
    userId: user.id,
    resourceType: "observation",
    resourceId: observation.id,
    details: {
      bookingId: parsed.data.bookingId,
      itemCount: parsed.data.items.length,
    },
    ipAddress,
    userAgent,
  });

  // If any item has medium or high severity, trigger follow-up notification
  const hasUrgent = parsed.data.items.some(
    (i) => i.severity === "medium" || i.severity === "high"
  );

  if (hasUrgent) {
    const findings = parsed.data.items
      .filter((i) => i.severity === "medium" || i.severity === "high")
      .map((i) => `${i.category}: ${i.description} (${i.severity})`)
      .join("; ");

    notifyObservationFollowUp(
      {
        name: booking.contactName,
        email: booking.contactEmail,
        phone: booking.contactPhone,
      },
      findings
    ).catch(() => {});

    await db
      .update(observations)
      .set({ followUpSent: true })
      .where(eq(observations.id, observation.id));

    logAudit({
      action: "observation.follow_up_sent",
      userId: user.id,
      resourceType: "observation",
      resourceId: observation.id,
      details: {
        bookingId: parsed.data.bookingId,
        customerEmail: booking.contactEmail,
      },
      ipAddress,
      userAgent,
    });
  }

  return c.json(observation, 201);
});

// List observations for this provider (paginated)
app.get("/", async (c) => {
  const user = c.get("user");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const [totalResult] = await db
    .select({ count: count() })
    .from(observations)
    .where(eq(observations.providerId, provider.id));

  const data = await db
    .select({
      observation: observations,
      booking: bookings,
      service: services,
    })
    .from(observations)
    .innerJoin(bookings, eq(observations.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(observations.providerId, provider.id))
    .orderBy(desc(observations.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    data,
    total: totalResult.count,
    page,
    limit,
    totalPages: Math.ceil(totalResult.count / limit),
  });
});

// Get single observation detail
app.get("/:id", async (c) => {
  const user = c.get("user");
  const observationId = c.req.param("id");

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const observation = await db.query.observations.findFirst({
    where: and(eq(observations.id, observationId), eq(observations.providerId, provider.id)),
  });

  if (!observation) {
    return c.json({ error: "Observation not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, observation.bookingId),
  });

  const service = booking
    ? await db.query.services.findFirst({
        where: eq(services.id, booking.serviceId),
      })
    : null;

  return c.json({ observation, booking, service });
});

// Get checklist config for a service type
app.get("/checklist/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");

  const service = await db.query.services.findFirst({
    where: eq(services.id, serviceId),
  });

  if (!service) {
    return c.json({ error: "Service not found" }, 404);
  }

  return c.json({ checklistConfig: service.checklistConfig || [] });
});

export default app;
