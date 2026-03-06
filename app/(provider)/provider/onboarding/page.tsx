import { Suspense } from "react";
import { OnboardingDashboard } from "@/components/onboarding/onboarding-dashboard";
import { Loader2 } from "lucide-react";

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Provider Onboarding</h1>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <OnboardingDashboard />
      </Suspense>
    </div>
  );
}
