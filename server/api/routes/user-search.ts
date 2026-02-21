import { Hono } from "hono";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or, ilike, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

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

  const results = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "customer"),
        or(
          ilike(users.name, `%${q}%`),
          ilike(users.email, `%${q}%`),
          ilike(users.phone, `%${q}%`)
        )
      )
    )
    .limit(10);

  return c.json({ data: results });
});

export default app;
