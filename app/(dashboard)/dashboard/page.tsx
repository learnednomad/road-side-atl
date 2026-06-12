import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TrustTierCard } from "@/components/dashboard/trust-tier-card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-neutral-950">
        Welcome back, {session.user.name || "Customer"}
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <TrustTierCard />

        <div className="space-y-4">
          <Link
            href="/my-bookings"
            className="block rounded-2xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50"
          >
            <p className="font-medium text-neutral-950">My Bookings</p>
            <p className="text-sm text-muted-foreground">View and manage your booking history</p>
          </Link>

          <Link
            href="/book"
            className="block rounded-2xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50"
          >
            <p className="font-medium text-neutral-950">Book a Service</p>
            <p className="text-sm text-muted-foreground">Schedule roadside assistance or an inspection</p>
          </Link>

          <Link
            href="/dashboard/referrals"
            className="block rounded-2xl border border-neutral-200 bg-white p-4 transition-colors hover:bg-neutral-50"
          >
            <p className="font-medium text-neutral-950">Referrals</p>
            <p className="text-sm text-muted-foreground">Share your referral code and earn credits</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
