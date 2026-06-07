import { createMiddleware } from "hono/factory";
import { db } from "@/db";
import { b2bAccountMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveUser } from "./auth";

export type B2bMemberEnv = {
  Variables: {
    user: { id: string; role: string; name?: string | null; email?: string | null };
    b2bAccountId: string;
    b2bRole: "owner" | "manager" | "member";
  };
};

/**
 * Authorize a B2B portal request: the user must be authenticated AND a member of
 * a B2B account. Resolves the membership and pins b2bAccountId/b2bRole onto the
 * context — portal handlers MUST scope every query to c.var.b2bAccountId and
 * never trust a client-supplied account id (prevents cross-tenant access).
 */
export const requireB2bMember = createMiddleware<B2bMemberEnv>(async (c, next) => {
  const user = await resolveUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", user);

  const membership = await db.query.b2bAccountMembers.findFirst({
    where: eq(b2bAccountMembers.userId, user.id),
  });
  if (!membership) {
    return c.json({ error: "Not a B2B account member" }, 403);
  }
  c.set("b2bAccountId", membership.accountId);
  c.set("b2bRole", membership.role as "owner" | "manager" | "member");
  await next();
});

/** Require the member to hold one of the given roles (else 403). */
export function requireB2bRole(...roles: Array<"owner" | "manager" | "member">) {
  return createMiddleware<B2bMemberEnv>(async (c, next) => {
    const role = c.get("b2bRole");
    if (!roles.includes(role)) {
      return c.json({ error: "Insufficient role" }, 403);
    }
    await next();
  });
}
