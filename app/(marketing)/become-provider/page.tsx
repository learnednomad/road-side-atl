import type { Metadata } from "next";
import { Suspense } from "react";
import { ApplicationForm } from "@/components/onboarding/application-form";

export const metadata: Metadata = {
  title: "Become a Provider | RoadSide GA",
  description: "Apply to join RoadSide GA as a roadside assistance provider.",
};

export default function BecomeProviderPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Become a Provider</h1>
        <p className="mt-2 text-muted-foreground">
          Join RoadSide GA and start earning by providing roadside assistance in the Atlanta metro area.
        </p>
      </div>
      <Suspense>
        <ApplicationForm />
      </Suspense>
    </div>
  );
}
