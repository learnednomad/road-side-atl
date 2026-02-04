import { Hono } from "hono";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

const app = new Hono();

app.post("/stripe", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "Missing signature" }, 400);
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;

    if (bookingId && session.id) {
      await db
        .update(payments)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
        })
        .where(eq(payments.stripeSessionId, session.id));
    }
  }

  return c.json({ received: true });
});

export default app;
