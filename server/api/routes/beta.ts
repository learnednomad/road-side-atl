import { Hono } from "hono";
import { db } from "@/db";
import { platformSettings, betaUsers, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";

const app = new Hono();

// GET /beta/status — public beta status + optional enrollment check
app.get("/status", async (c) => {
  // Read beta settings from platform_settings
  const settings = await db.query.platformSettings.findMany({
    where: inArray(platformSettings.key, ["beta_active", "beta_start_date", "beta_end_date"]),
  });

  const activeSetting = settings.find((s) => s.key === "beta_active");
  const active = activeSetting?.value === "true";
  const startDate = settings.find((s) => s.key === "beta_start_date")?.value ?? null;
  const endDate = settings.find((s) => s.key === "beta_end_date")?.value ?? null;

  // Check enrollment if authenticated (optional — no middleware, manual resolve)
  let enrolled = false;
  let userId: string | null = null;

  const session = await auth();
  if (session?.user?.id) {
    userId = session.user.id;
  }

  if (userId) {
    const betaUser = await db.query.betaUsers.findFirst({
      where: eq(betaUsers.userId, userId),
    });
    enrolled = !!betaUser;
  }

  return c.json({ active, startDate, endDate, enrolled });
});

export default app;
