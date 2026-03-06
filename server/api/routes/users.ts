import { Hono } from "hono";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { getAllowedPaymentMethods, getPromotionThreshold } from "../lib/trust-tier";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

const app = new Hono<AuthEnv>();

app.use("/*", requireAuth);

app.get("/me/trust-tier", async (c) => {
  const user = c.get("user");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { trustTier: true, cleanTransactionCount: true },
  });

  if (!dbUser) return c.json({ error: "User not found" }, 404);

  const threshold = await getPromotionThreshold();
  const allowedMethods = getAllowedPaymentMethods(dbUser.trustTier);

  return c.json({
    trustTier: dbUser.trustTier,
    cleanTransactionCount: dbUser.cleanTransactionCount,
    promotionThreshold: threshold,
    allowedPaymentMethods: allowedMethods,
  });
});

export default app;
