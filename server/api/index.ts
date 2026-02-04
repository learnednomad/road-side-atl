import { Hono } from "hono";
import servicesRoutes from "./routes/services";
import bookingsRoutes from "./routes/bookings";
import adminRoutes from "./routes/admin";
import paymentsRoutes from "./routes/payments";
import webhooksRoutes from "./routes/webhooks";

const app = new Hono().basePath("/api");

app.route("/services", servicesRoutes);
app.route("/bookings", bookingsRoutes);
app.route("/admin", adminRoutes);
app.route("/payments", paymentsRoutes);
app.route("/webhooks", webhooksRoutes);

export default app;
