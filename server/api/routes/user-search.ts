import { Hono } from "hono";
import { db } from "@/db";
import { users, providers, bookings } from "@/db/schema";
import { eq, or, ilike, and, exists } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { escapeLike } from "../lib/sql-escape";

type AuthEnv = {
  Variables: {
    user: {
      id: string;
      role: string;
      name?: string | null;
      email?: string | null;
    };
  };
};

const app = new Hono<AuthEnv>();

// GET /search?q= - provider or admin
app.get("/search", requireAuth, async (c) => {
  const user = c.get("user");
  if (user.role !== "provider" && user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const q = c.req.query("q");
  if (!q || q.length < 2) {
    return c.json({ data: [] });
  }

  // Escape LIKE wildcards so the query matches literally (L5).
  const safe = escapeLike(q);
  const conditions = [
    eq(users.role, "customer"),
    or(
      ilike(users.name, `%${safe}%`),
      ilike(users.email, `%${safe}%`),
      ilike(users.phone, `%${safe}%`)
    )!,
  ];

  // Providers may only search customers they have actually serviced — otherwise
  // any provider could enumerate the entire customer PII database (M2). Admins
  // retain full search.
  if (user.role === "provider") {
    const providerRecord = await db.query.providers.findFirst({
      where: eq(providers.userId, user.id),
      columns: { id: true },
    });
    if (!providerRecord) {
      return c.json({ data: [] });
    }
    conditions.push(
      exists(
        db
          .select({ one: bookings.id })
          .from(bookings)
          .where(
            and(
              eq(bookings.providerId, providerRecord.id),
              eq(bookings.userId, users.id)
            )
          )
      )
    );
  }

  const results = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(and(...conditions))
    .limit(10);

  return c.json({ data: results });
});

export default app;
