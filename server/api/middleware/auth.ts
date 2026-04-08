import { createMiddleware } from "hono/factory";
import { auth } from "@/lib/auth";
import { decode } from "next-auth/jwt";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NEXTAUTH_JWT_SALT } from "@/lib/constants";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

/**
 * Resolve session from NextAuth cookies OR Bearer token.
 * NextAuth's auth() reads from cookies automatically.
 * For mobile clients, we also accept Authorization: Bearer <session-token>
 * and decode the NextAuth JWT manually.
 */
async function resolveUser(c: { req: { header: (name: string) => string | undefined } }) {
  // 1. Try NextAuth session (works for web with cookies)
  const session = await auth();
  if (session?.user?.id) {
    return session.user as AuthEnv["Variables"]["user"];
  }

  // 2. Fall back to Bearer token (mobile clients)
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  try {
    const decoded = await decode({ token, secret, salt: NEXTAUTH_JWT_SALT });
    if (!decoded?.sub) return null;

    // Look up user to get current role
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.sub),
      columns: { id: true, role: true, name: true, email: true },
    });
    if (!user) return null;

    return { id: user.id, role: user.role, name: user.name, email: user.email };
  } catch {
    return null;
  }
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const user = await resolveUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", user);
  await next();
});

export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  const user = await resolveUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  c.set("user", user);
  await next();
});

export const requireProvider = createMiddleware<AuthEnv>(async (c, next) => {
  const user = await resolveUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (user.role !== "provider") {
    return c.json({ error: "Forbidden" }, 403);
  }
  c.set("user", user);
  await next();
});
