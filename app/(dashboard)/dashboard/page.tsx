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
      <h1 className="mb-6 text-2xl font-bold">
        Welcome back, {session.user.name || "Customer"}
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <TrustTierCard />

        <div className="space-y-4">
          <Link
            href="/my-bookings"
            className="block rounded-lg border p-4 transition-colors hover:bg-muted"
          >
            <p className="font-medium">My Bookings</p>
            <p className="text-sm text-muted-foreground">View and manage your booking history</p>
          </Link>

          <Link
            href="/book"
            className="block rounded-lg border p-4 transition-colors hover:bg-muted"
          >
            <p className="font-medium">Book a Service</p>
            <p className="text-sm text-muted-foreground">Schedule roadside assistance or an inspection</p>
          </Link>

          <Link
            href="/dashboard/referrals"
            className="block rounded-lg border p-4 transition-colors hover:bg-muted"
          >
            <p className="font-medium">Referrals</p>
            <p className="text-sm text-muted-foreground">Share your referral code and earn credits</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
