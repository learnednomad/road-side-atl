"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  interval: "month" | "year";
  discountBp: number;
  priorityDispatch: boolean;
}

interface CurrentMembership {
  planId: string;
  status: string;
  discountBp: number;
  currentPeriodEnd: string | null;
  planName: string;
  priorityDispatch: boolean;
}

function CurrentMembershipCard({ membership }: { membership: CurrentMembership }) {
  return (
    <div className="mb-10 rounded-2xl border-2 border-red-600 bg-white p-8">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-red-600">
        Your membership
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
        {membership.planName}
      </p>
      <p className="mt-2 text-neutral-600">
        {`${(membership.discountBp / 100).toFixed(0)}% off every booking`}
        {membership.priorityDispatch ? "  ·  Priority dispatch" : ""}
      </p>
      {membership.currentPeriodEnd ? (
        <p className="mt-4 font-mono text-xs uppercase tracking-wider text-neutral-500">
          {`Renews ${new Date(membership.currentPeriodEnd).toLocaleDateString()}`}
        </p>
      ) : null}
    </div>
  );
}

function PlanCard({
  plan,
  isMember,
  onSubscribe,
  busy,
}: {
  plan: Plan;
  isMember: boolean;
  onSubscribe: () => void;
  busy: boolean;
}) {
  const perks = [
    `${(plan.discountBp / 100).toFixed(0)}% off every roadside booking`,
    ...(plan.priorityDispatch ? ["Priority dispatch — jump the queue"] : []),
    "Cancel anytime",
  ];
  return (
    <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white/40 p-8">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
        {plan.name}
      </p>
      <p className="mt-4 font-mono text-4xl font-semibold tracking-tight text-neutral-950">
        {formatPrice(plan.priceCents)}
        <span className="ml-1 align-middle font-sans text-sm font-normal text-neutral-500">
          /{plan.interval === "year" ? "yr" : "mo"}
        </span>
      </p>
      <ul className="mt-6 flex-1 space-y-3">
        {perks.map((perk) => (
          <li key={perk} className="flex items-start gap-3 text-sm text-neutral-700">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            {perk}
          </li>
        ))}
      </ul>
      {!isMember ? (
        <Button
          onClick={onSubscribe}
          disabled={busy}
          className="mt-8 w-fit rounded-full bg-neutral-950 px-7 py-6 font-mono text-sm uppercase tracking-wider hover:bg-neutral-800"
        >
          Subscribe
          <ArrowRight aria-hidden className="ml-2 h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

export function MembershipClient({
  plans,
  membership,
}: {
  plans: Plan[];
  membership: CurrentMembership | null;
}) {
  const searchParams = useSearchParams();
  const justJoined = searchParams.get("joined") === "true";
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

  const subscribe = async (planId: string) => {
    setBusyPlanId(planId);
    try {
      const res = await fetch("/api/memberships/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        toast.error(data?.error || "Could not start checkout");
        setBusyPlanId(null);
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast.error("Could not start checkout");
      setBusyPlanId(null);
    }
  };

  return (
    <div className="bg-[#faf9f6]">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
          <span aria-hidden className="h-3 w-0.5 bg-red-600" />
          Membership
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 md:text-4xl">
          Save on every booking
        </h1>
        <p className="mt-3 mb-10 max-w-xl text-neutral-600">
          Members get a discount on every roadside booking and priority dispatch
          across metro Atlanta.
        </p>

        {justJoined && membership ? (
          <div className="mb-8 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Welcome aboard — your membership is active. Your discount applies
            automatically at booking time.
          </div>
        ) : null}
        {justJoined && !membership ? (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Payment received — your membership is activating. Refresh in a
            moment if it isn&apos;t showing yet.
          </div>
        ) : null}

        {membership ? <CurrentMembershipCard membership={membership} /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isMember={!!membership}
              onSubscribe={() => subscribe(plan.id)}
              busy={busyPlanId === plan.id}
            />
          ))}
          {plans.length === 0 ? (
            <p className="text-neutral-500">No plans available right now.</p>
          ) : null}
        </div>

        <p className="mt-10 text-sm text-neutral-500">
          Earning points too?{" "}
          <Link href="/account/loyalty" className="font-medium text-neutral-950 underline-offset-4 hover:underline">
            See your loyalty balance →
          </Link>
        </p>
      </div>
    </div>
  );
}
