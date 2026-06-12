import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { membershipPlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getActiveMembership } from "@/server/api/lib/memberships";
import { buildMetadata } from "@/lib/seo";
import { MembershipClient } from "./membership-client";

export const metadata: Metadata = buildMetadata({
  title: "Membership - Save on Every Booking | RoadSide GA",
  description:
    "Join a RoadSide GA membership: a discount on every roadside booking plus priority dispatch across metro Atlanta.",
  path: "/account/membership",
});

export default async function MembershipPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/account/membership");
  }

  const [plans, membership] = await Promise.all([
    db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.active, true))
      .orderBy(membershipPlans.priceCents),
    getActiveMembership(session.user.id),
  ]);

  const currentPlan = membership
    ? (plans.find((p) => p.id === membership.planId) ?? null)
    : null;

  return (
    <MembershipClient
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        interval: p.interval,
        discountBp: p.discountBp,
        priorityDispatch: p.priorityDispatch,
      }))}
      membership={
        membership
          ? {
              planId: membership.planId,
              status: membership.status,
              discountBp: membership.discountBp,
              currentPeriodEnd: membership.currentPeriodEnd?.toISOString() ?? null,
              planName: currentPlan?.name ?? "Member",
              priorityDispatch: currentPlan?.priorityDispatch ?? false,
            }
          : null
      }
    />
  );
}
