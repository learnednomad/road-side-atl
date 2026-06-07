/**
 * Consumer loyalty: view balance/ledger and redeem points for a discount on a
 * pending booking (1 point = 1 cent). All scoped to the authenticated user.
 */
import { Hono } from "hono";
import { db } from "@/db";
import { loyaltyTransactions, bookings, users } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { redeemLoyaltySchema } from "@/lib/validators";
import { redeemLoyalty } from "../lib/loyalty";

type AuthEnv = { Variables: { user: { id: string; role: string } } };
const app = new Hono<AuthEnv>();
app.use("/*", requireAuth);

// GET / — balance + ledger
app.get("/", async (c) => {
  const user = c.get("user");
  const txns = await db
    .select()
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.userId, user.id))
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(100);
  const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  return c.json({ balance: dbUser?.loyaltyPoints ?? 0, transactions: txns });
});

// POST /redeem — apply points as a discount to the user's pending booking
app.post("/redeem", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = redeemLoyaltySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, parsed.data.bookingId), eq(bookings.userId, user.id)),
  });
  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.status !== "pending") return c.json({ error: "Booking is not pending" }, 400);

  // Cap redemption at the booking price.
  const points = Math.min(parsed.data.points, booking.estimatedPrice);
  let centsApplied: number;
  try {
    centsApplied = await redeemLoyalty(user.id, points, booking.id);
  } catch {
    return c.json({ error: "Insufficient loyalty points" }, 400);
  }
  const [updated] = await db
    .update(bookings)
    .set({ estimatedPrice: booking.estimatedPrice - centsApplied, updatedAt: new Date() })
    .where(eq(bookings.id, booking.id))
    .returning();
  return c.json({ discountCents: centsApplied, booking: updated });
});

export default app;
