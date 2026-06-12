import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { loyaltyTransactions, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Loyalty Points | RoadSide GA",
  description:
    "Earn 1 point per $1 on completed bookings and redeem points for discounts — 1 point = 1¢ off.",
  path: "/account/loyalty",
});

const TYPE_LABEL: Record<string, string> = {
  earn: "Earned",
  redeem: "Redeemed",
  adjust: "Adjustment",
};

export default async function LoyaltyPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/account/loyalty");
  }

  const [user, transactions] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { loyaltyPoints: true },
    }),
    db
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.userId, session.user.id))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(100),
  ]);

  const balance = user?.loyaltyPoints ?? 0;

  return (
    <div className="bg-[#faf9f6]">
      <div className="container mx-auto max-w-3xl px-4 py-16">
        <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
          <span aria-hidden className="h-3 w-0.5 bg-red-600" />
          Rewards
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl">
          Loyalty Points
        </h1>

        <div className="mt-8 rounded-2xl bg-neutral-950 p-8 text-white">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-400">
            Your balance
          </p>
          <p className="mt-4 font-mono text-5xl font-semibold tracking-tight">
            {balance.toLocaleString("en-US")}
          </p>
          <p className="mt-2 text-neutral-300">
            {`points · worth $${(balance / 100).toFixed(2)}`}
          </p>
        </div>

        <p className="mt-6 text-sm text-neutral-600">
          Earn 1 point per $1 spent on completed bookings. Apply points to any
          pending booking from{" "}
          <Link href="/my-bookings" className="font-medium text-neutral-950 underline-offset-4 hover:underline">
            My Bookings
          </Link>{" "}
          — 1 point = 1¢ off.
        </p>

        <h2 className="mt-12 mb-2 text-lg font-semibold tracking-tight text-neutral-950">
          History
        </h2>
        {transactions.length === 0 ? (
          <p className="border-t border-neutral-200 py-10 text-center text-neutral-500">
            No activity yet — book a service to start earning.
          </p>
        ) : (
          <div>
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-baseline justify-between gap-4 border-t border-neutral-200 py-4"
              >
                <div>
                  <p className="font-medium text-neutral-950">
                    {TYPE_LABEL[tx.type] ?? tx.type}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {tx.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {tx.notes ? ` · ${tx.notes}` : ""}
                  </p>
                </div>
                <p
                  className={`font-mono text-lg font-semibold tabular-nums ${
                    tx.points >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {`${tx.points > 0 ? "+" : ""}${tx.points.toLocaleString("en-US")}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
