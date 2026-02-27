import { Hono } from "hono";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getWSS } from "@/server/websocket/server";
import { getConnectionCount } from "@/server/websocket/connections";
import servicesRoutes from "./routes/services";
import bookingsRoutes from "./routes/bookings";
import adminRoutes from "./routes/admin";
import adminProvidersRoutes from "./routes/admin-providers";
import adminPayoutsRoutes from "./routes/admin-payouts";
import paymentsRoutes from "./routes/payments";
import webhooksRoutes from "./routes/webhooks";
import authRoutes from "./routes/auth";
import providerRoutes from "./routes/provider";
import geocodingRoutes from "./routes/geocoding";
import receiptsRoutes from "./routes/receipts";
import reviewsRoutes from "./routes/reviews";
import customerRoutes from "./routes/customer";
import pushRoutes from "./routes/push";
import providerRegistrationRoutes from "./routes/provider-registration";
import invoicesRoutes from "./routes/invoices";
import businessSettingsRoutes from "./routes/business-settings";
import uploadRoutes from "./routes/upload";
import userSearchRoutes from "./routes/user-search";
import adminFinancesRoutes from "./routes/admin-finances";
import adminInvoicesRoutes from "./routes/admin-invoices";
import providerInvoicesRoutes from "./routes/provider-invoices";
import customerInvoicesRoutes from "./routes/customer-invoices";
import trustTierRoutes from "./routes/trust-tier";
import observationsRoutes from "./routes/observations";
import referralsRoutes from "./routes/referrals";
import inspectionReportsRoutes from "./routes/inspection-reports";
import usersRoutes from "./routes/users";
import pricingConfigRoutes from "./routes/pricing-config";
import pricingEstimateRoutes from "./routes/pricing-estimate";
import financialReportsRoutes from "./routes/financial-reports";
import b2bAccountsRoutes from "./routes/b2b-accounts";

const app = new Hono().basePath("/api");

// Health endpoint — PUBLIC (no auth), used by monitoring and Docker health checks (NFR37: <5s response)
app.get("/health", async (c) => {
  const checks: Record<string, { status: string; latency?: number }> = {};

  // Run DB and Stripe checks in parallel to stay under 5s (NFR37)
  const dbCheck = (async () => {
    const start = Date.now();
    try {
      await Promise.race([
        db.execute(sql`SELECT 1`),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ]);
      return { status: "healthy", latency: Date.now() - start } as const;
    } catch {
      return { status: "unhealthy", latency: Date.now() - start } as const;
    }
  })();

  const stripeCheck = (async () => {
    const start = Date.now();
    try {
      if (!process.env.STRIPE_SECRET_KEY) return { status: "unconfigured" } as const;
      const { getStripe } = await import("@/lib/stripe");
      await Promise.race([
        getStripe().balance.retrieve(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ]);
      return { status: "healthy", latency: Date.now() - start } as const;
    } catch {
      return { status: "unhealthy", latency: Date.now() - start } as const;
    }
  })();

  const [dbResult, stripeResult] = await Promise.all([dbCheck, stripeCheck]);
  checks.database = dbResult;
  checks.stripe = stripeResult;

  // WebSocket server check (synchronous — no timeout needed)
  const wss = getWSS();
  checks.websocket = { status: wss ? "healthy" : "unhealthy", latency: 0 };
  const wsConnections = getConnectionCount();

  const allHealthy = Object.values(checks).every(
    (check) => check.status === "healthy" || check.status === "unconfigured"
  );

  return c.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      checks,
      wsConnections,
      timestamp: new Date().toISOString(),
    },
    allHealthy ? 200 : 503,
  );
});

app.route("/services", servicesRoutes);
app.route("/bookings", bookingsRoutes);
app.route("/admin", adminRoutes);
app.route("/admin/providers", adminProvidersRoutes);
app.route("/admin/payouts", adminPayoutsRoutes);
app.route("/payments", paymentsRoutes);
app.route("/webhooks", webhooksRoutes);
app.route("/auth-routes", authRoutes);
app.route("/provider", providerRoutes);
app.route("/geocoding", geocodingRoutes);
app.route("/receipts", receiptsRoutes);
app.route("/reviews", reviewsRoutes);
app.route("/customer", customerRoutes);
app.route("/push", pushRoutes);
app.route("/provider-registration", providerRegistrationRoutes);
app.route("/invoices", invoicesRoutes);
app.route("/business-settings", businessSettingsRoutes);
app.route("/upload", uploadRoutes);
app.route("/users", userSearchRoutes);
app.route("/admin/finances", adminFinancesRoutes);
app.route("/admin/invoices", adminInvoicesRoutes);
app.route("/provider/invoices", providerInvoicesRoutes);
app.route("/customer/invoices", customerInvoicesRoutes);
app.route("/admin/trust-tier", trustTierRoutes);
app.route("/provider/observations", observationsRoutes);
app.route("/referrals", referralsRoutes);
app.route("/inspection-reports", inspectionReportsRoutes);
app.route("/users-admin", usersRoutes);
app.route("/admin/pricing", pricingConfigRoutes);
app.route("/pricing-estimate", pricingEstimateRoutes);
app.route("/admin/financial-reports", financialReportsRoutes);
app.route("/admin/b2b-accounts", b2bAccountsRoutes);

export default app;
