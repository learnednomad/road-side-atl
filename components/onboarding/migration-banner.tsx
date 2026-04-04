"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface MigrationBannerProps {
  deadlineIso: string;
  completedSteps: number;
  totalSteps: number;
}

export function MigrationBanner({ deadlineIso, completedSteps, totalSteps }: MigrationBannerProps) {
  const daysRemaining = useMemo(() => {
    const deadline = new Date(deadlineIso);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  }, [deadlineIso]);

  const isUrgent = daysRemaining <= 5;
  const isWarning = daysRemaining <= 14;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const deadlineFormatted = new Date(deadlineIso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card className={cn(
      "border-2",
      isUrgent ? "border-destructive bg-destructive/5" : isWarning ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-blue-500 bg-blue-50 dark:bg-blue-950/20",
    )}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-3">
          {isUrgent ? (
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-destructive" />
          ) : (
            <Clock className="h-5 w-5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          )}
          <div className="space-y-1">
            <h3 className={cn(
              "text-sm font-semibold",
              isUrgent ? "text-destructive" : "text-foreground",
            )}>
              {isUrgent
                ? `Urgent: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`
                : `Compliance Migration — ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`}
            </h3>
            <p className="text-sm text-muted-foreground">
              Complete your onboarding steps by <strong>{deadlineFormatted}</strong> to
              continue receiving jobs.
              {isUrgent && " Your account will be suspended if not completed."}
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {completedSteps} of {totalSteps} steps completed
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} />
        </div>
      </CardContent>
    </Card>
  );
}
