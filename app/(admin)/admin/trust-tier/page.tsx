import { Metadata } from "next";
import { TrustTierTable } from "@/components/admin/trust-tier-table";
import { db } from "@/db";
import { users, platformSettings } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { TRUST_TIER_PROMOTION_THRESHOLD } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trust Tier | Admin | RoadSide ATL",
};

const PAGE_SIZE = 20;

export default async function AdminTrustTierPage() {
  const [totalResult] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.role, "customer"));

  const customers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      trustTier: users.trustTier,
      cleanTransactionCount: users.cleanTransactionCount,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, "customer"))
    .orderBy(desc(users.cleanTransactionCount))
    .limit(PAGE_SIZE);

  const total = totalResult.count;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const setting = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "trust_tier_promotion_threshold"),
  });
  const promotionThreshold = setting
    ? parseInt(setting.value, 10)
    : TRUST_TIER_PROMOTION_THRESHOLD;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Trust Tier Management</h1>
      <TrustTierTable
        customers={customers}
        total={total}
        page={1}
        totalPages={totalPages}
        promotionThreshold={promotionThreshold}
      />
    </div>
  );
}
