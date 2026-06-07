/** Active membership lookup for applying member discounts at booking time. */
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function getActiveMembership(userId: string | null | undefined) {
  if (!userId) return null;
  const m = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.status, "active")),
  });
  if (!m) return null;
  if (m.currentPeriodEnd && m.currentPeriodEnd.getTime() < Date.now()) return null; // lapsed
  return m;
}
