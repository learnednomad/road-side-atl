import { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

import { PaymentMethodsClient } from "@/components/account/payment-methods-client";

export const metadata: Metadata = buildMetadata({
  title: "Payment Methods | RoadSide GA",
  description: "Manage the cards saved to your RoadSide GA account.",
  path: "/account/payment-methods",
});

export default async function PaymentMethodsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/account/payment-methods");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Payment Methods</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add or remove the cards saved to your account.
      </p>
      <div className="mt-6">
        <PaymentMethodsClient />
      </div>
    </div>
  );
}
