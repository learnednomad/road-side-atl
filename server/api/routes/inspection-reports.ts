import { Hono } from "hono";
import { db } from "@/db";
import { inspectionReports, bookings, providers, services } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { createInspectionReportSchema } from "@/lib/validators";
import { logAudit, getRequestInfo } from "../lib/audit-logger";
import { generateInspectionPDF } from "../lib/pdf-generator";
import { notifyInspectionReport } from "@/lib/notifications";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAuth);

// Submit inspection report (provider only)
app.post("/", async (c) => {
  const user = c.get("user");

  if (user.role !== "provider") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const parsed = createInspectionReportSchema.safeParse(body);

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

  // Check for duplicate report on same booking
  const existing = await db.query.inspectionReports.findFirst({
    where: eq(inspectionReports.bookingId, parsed.data.bookingId),
  });

  if (existing) {
    return c.json({ error: "Inspection report already submitted for this booking" }, 409);
  }

  const [report] = await db
    .insert(inspectionReports)
    .values({
      bookingId: parsed.data.bookingId,
      providerId: provider.id,
      findings: parsed.data.findings,
    })
    .returning();

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  await logAudit({
    action: "inspection.generate",
    userId: user.id,
    resourceType: "inspection_report",
    resourceId: report.id,
    details: {
      bookingId: parsed.data.bookingId,
      findingCount: parsed.data.findings.length,
    },
    ipAddress,
    userAgent,
  });

  return c.json(report, 201);
});

// Get provider's inspection reports (paginated) — must be before /:id to avoid route collision
app.get("/provider/list", async (c) => {
  const user = c.get("user");

  if (user.role !== "provider") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const page = Math.max(parseInt(c.req.query("page") || "1") || 1, 1);
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20") || 20, 1), 100);
  const offset = (page - 1) * limit;

  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, user.id),
  });

  if (!provider) {
    return c.json({ error: "Provider profile not found" }, 404);
  }

  const [totalResult] = await db
    .select({ count: count() })
    .from(inspectionReports)
    .where(eq(inspectionReports.providerId, provider.id));

  const data = await db
    .select({
      report: inspectionReports,
      booking: bookings,
      service: services,
    })
    .from(inspectionReports)
    .innerJoin(bookings, eq(inspectionReports.bookingId, bookings.id))
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(inspectionReports.providerId, provider.id))
    .orderBy(desc(inspectionReports.createdAt))
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

// Get inspection report (HTML data)
app.get("/:id", async (c) => {
  const user = c.get("user");
  const reportId = c.req.param("id");

  const report = await db.query.inspectionReports.findFirst({
    where: eq(inspectionReports.id, reportId),
  });

  if (!report) {
    return c.json({ error: "Inspection report not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, report.bookingId),
  });

  if (!booking) {
    return c.json({ error: "Associated booking not found" }, 404);
  }

  // Verify access: provider who created it, admin, or customer who owns the booking
  const isProvider = user.role === "provider";
  const isAdmin = user.role === "admin";
  const isCustomer = booking.userId === user.id;

  if (isProvider) {
    const provider = await db.query.providers.findFirst({
      where: eq(providers.userId, user.id),
    });
    if (!provider || provider.id !== report.providerId) {
      return c.json({ error: "Forbidden" }, 403);
    }
  } else if (!isAdmin && !isCustomer) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const service = await db.query.services.findFirst({
    where: eq(services.id, booking.serviceId),
  });

  return c.json({ report, booking, service });
});

// Generate and download PDF
app.get("/:id/pdf", async (c) => {
  const user = c.get("user");
  const reportId = c.req.param("id");

  const report = await db.query.inspectionReports.findFirst({
    where: eq(inspectionReports.id, reportId),
  });

  if (!report) {
    return c.json({ error: "Inspection report not found" }, 404);
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, report.bookingId),
  });

  if (!booking) {
    return c.json({ error: "Associated booking not found" }, 404);
  }

  // Verify access: provider who created it, admin, or customer who owns the booking
  const isAdmin = user.role === "admin";
  const isCustomer = booking.userId === user.id;

  if (user.role === "provider") {
    const provider = await db.query.providers.findFirst({
      where: eq(providers.userId, user.id),
    });
    if (!provider || provider.id !== report.providerId) {
      return c.json({ error: "Forbidden" }, 403);
    }
  } else if (!isAdmin && !isCustomer) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Find provider name for the report header
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, report.providerId),
  });

  const vehicleInfoRaw = booking.vehicleInfo as Record<string, string> || {};
  const vehicleInfo = {
    year: vehicleInfoRaw.year || '',
    make: vehicleInfoRaw.make || '',
    model: vehicleInfoRaw.model || '',
    color: vehicleInfoRaw.color || '',
  };

  try {
    const pdfBuffer = await generateInspectionPDF({
      inspectionDate: report.createdAt.toISOString().split("T")[0],
      vehicleInfo,
      providerName: provider?.name || "Unknown Provider",
      findings: report.findings,
      bookingId: report.bookingId,
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="inspection-report-${reportId}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[InspectionReport] PDF generation failed:", error);
    return c.json({ error: "PDF generation failed" }, 500);
  }
});

// Email report to customer
app.post("/:id/email", async (c) => {
  const user = c.get("user");
  const reportId = c.req.param("id");

  const report = await db.query.inspectionReports.findFirst({
    where: eq(inspectionReports.id, reportId),
  });

  if (!report) {
    return c.json({ error: "Inspection report not found" }, 404);
  }

  // Idempotency: reject if email was already sent
  if (report.emailedAt) {
    return c.json({ error: "Inspection report email already sent" }, 409);
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, report.bookingId),
  });

  if (!booking) {
    return c.json({ error: "Associated booking not found" }, 404);
  }

  // Only the provider who created it or admin can send the email
  const isAdmin = user.role === "admin";

  if (user.role === "provider") {
    const provider = await db.query.providers.findFirst({
      where: eq(providers.userId, user.id),
    });
    if (!provider || provider.id !== report.providerId) {
      return c.json({ error: "Forbidden" }, 403);
    }
  } else if (!isAdmin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const vehicleInfoRaw = booking.vehicleInfo as Record<string, string> || {};
  const vehicleDescription = `${vehicleInfoRaw.year || ''} ${vehicleInfoRaw.make || ''} ${vehicleInfoRaw.model || ''}`.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roadsideatl.com";
  const reportUrl = `${appUrl}/inspection-reports/${reportId}`;

  // Await email notification and only set emailedAt on success
  const inspectionDate = report.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  try {
    await notifyInspectionReport(
      { name: booking.contactName, email: booking.contactEmail },
      booking.id,
      vehicleDescription,
      reportUrl,
      inspectionDate,
    );

    // Update emailedAt timestamp only after successful notification
    await db
      .update(inspectionReports)
      .set({ emailedAt: new Date() })
      .where(eq(inspectionReports.id, reportId));
  } catch (error) {
    console.error("[InspectionReport] Email notification failed:", error);
    return c.json({ error: "Failed to send email notification" }, 500);
  }

  const { ipAddress, userAgent } = getRequestInfo(c.req.raw);

  await logAudit({
    action: "inspection.email_sent",
    userId: user.id,
    resourceType: "inspection_report",
    resourceId: reportId,
    details: {
      bookingId: booking.id,
      customerEmail: booking.contactEmail,
    },
    ipAddress,
    userAgent,
  });

  return c.json({ success: true }, 200);
});

export default app;
