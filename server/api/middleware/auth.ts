import { createMiddleware } from "hono/factory";
import { auth } from "@/lib/auth";

type AuthEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
  };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth();
  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", session.user as AuthEnv["Variables"]["user"]);
  await next();
});

export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth();
  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (session.user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  c.set("user", session.user as AuthEnv["Variables"]["user"]);
  await next();
});
