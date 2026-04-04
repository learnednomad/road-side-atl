"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { StepCard, type OnboardingStep } from "./step-card";
import { MigrationBanner } from "./migration-banner";
import { useWS } from "@/components/providers/websocket-provider";

interface ProviderSummary {
  status: string;
  name: string;
  completedStepsCount: number;
  totalSteps: number;
  migrationBypassExpiresAt: string | null;
  isMigrating: boolean;
}

interface DashboardData {
  steps: OnboardingStep[];
  provider: ProviderSummary;
}

export function OnboardingDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastEvent } = useWS();

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/dashboard");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load dashboard (${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time: re-fetch dashboard when onboarding-related WebSocket events arrive
  useEffect(() => {
    if (!lastEvent) return;
    const { type } = lastEvent;
    if (
      type === "onboarding:step_updated" ||
      type === "onboarding:document_reviewed" ||
      type === "onboarding:activated"
    ) {
      fetchDashboard();
    }
  }, [lastEvent, fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchDashboard(); }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { steps, provider } = data;

  // Active provider — check if migrating or fully onboarded
  if (provider.status === "active" && !provider.isMigrating) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          <h2 className="text-xl font-semibold">You&apos;re All Set!</h2>
          <p className="text-center text-muted-foreground max-w-md">
            Your onboarding is complete. You can now access the full provider portal,
            accept jobs, and start earning.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Pending review — all steps done, waiting for admin
  if (provider.status === "pending_review") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Clock className="h-12 w-12 text-amber-500 dark:text-amber-400" />
          <h2 className="text-xl font-semibold">Pending Admin Review</h2>
          <p className="text-center text-muted-foreground max-w-md">
            All onboarding steps are complete. An admin will review your profile
            and activate your account shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Rejected or suspended — show reason
  if (provider.status === "rejected" || provider.status === "suspended") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <XCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">
            {provider.status === "rejected" ? "Application Rejected" : "Account Suspended"}
          </h2>
          <p className="text-center text-muted-foreground max-w-md">
            {provider.status === "rejected"
              ? "Your provider application has been rejected. Please contact support for more information."
              : "Your account has been suspended. Please contact support to resolve this issue."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Order steps by step type to ensure consistent display
  const stepOrder = ["background_check", "insurance", "certifications", "training", "stripe_connect"];
  const orderedSteps = [...steps].sort(
    (a, b) => stepOrder.indexOf(a.stepType) - stepOrder.indexOf(b.stepType),
  );

  // Migration mode: show only incomplete steps with deadline banner
  if (provider.isMigrating && provider.migrationBypassExpiresAt) {
    const incompleteSteps = orderedSteps.filter((s) => s.status !== "complete");
    const completedSteps = orderedSteps.filter((s) => s.status === "complete");

    return (
      <div className="space-y-6">
        <MigrationBanner
          deadlineIso={provider.migrationBypassExpiresAt}
          completedSteps={provider.completedStepsCount}
          totalSteps={provider.totalSteps}
        />

        {/* Incomplete steps — action needed */}
        {incompleteSteps.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Steps to Complete</h3>
            {incompleteSteps.map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </div>
        )}

        {/* Completed steps — collapsed context */}
        {completedSteps.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Completed</h3>
            {completedSteps.map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular onboarding / applied — show all steps
  const progressPercent =
    provider.totalSteps > 0
      ? Math.round((provider.completedStepsCount / provider.totalSteps) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Progress summary */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {provider.completedStepsCount} of {provider.totalSteps} steps completed
            </p>
            <span className="text-sm text-muted-foreground">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} />
        </CardContent>
      </Card>

      {/* Step cards */}
      <div className="space-y-3">
        {orderedSteps.map((step) => (
          <StepCard key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
}
