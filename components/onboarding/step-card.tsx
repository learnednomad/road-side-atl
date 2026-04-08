"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  FileCheck,
  Award,
  BookOpen,
  CreditCard,
  Check,
  AlertCircle,
} from "lucide-react";

export interface OnboardingStep {
  id: string;
  stepType: string;
  status: string;
  rejectionReason: string | null;
}

const STEP_CONFIG: Record<
  string,
  { icon: typeof Shield; label: string; description: string }
> = {
  background_check: {
    icon: Shield,
    label: "Background Check",
    description: "Criminal + MVR check via Checkr",
  },
  insurance: {
    icon: FileCheck,
    label: "Insurance",
    description: "Upload commercial auto insurance",
  },
  certifications: {
    icon: Award,
    label: "Certifications",
    description: "Upload tow license & certs",
  },
  training: {
    icon: BookOpen,
    label: "Training",
    description: "Complete policy acknowledgments",
  },
  stripe_connect: {
    icon: CreditCard,
    label: "Payment Setup",
    description: "Set up Stripe for payouts",
  },
};

const STATUS_BADGE: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; text: string }
> = {
  pending: { variant: "secondary", text: "Not Started" },
  draft: { variant: "default", text: "In Progress" },
  in_progress: { variant: "default", text: "In Progress" },
  pending_review: { variant: "outline", text: "Pending Review" },
  complete: { variant: "secondary", text: "Approved" },
  rejected: { variant: "destructive", text: "Rejected" },
  blocked: { variant: "secondary", text: "Blocked" },
};

function getActionLabel(status: string): string | null {
  switch (status) {
    case "pending":
      return "Start";
    case "draft":
      return "Continue";
    case "in_progress":
      return "View Status";
    case "rejected":
      return "Re-submit";
    default:
      return null;
  }
}

// Step types that support navigation
const DOCUMENT_STEP_TYPES = new Set(["insurance", "certifications"]);
const NAVIGABLE_STEP_TYPES = new Set(["insurance", "certifications", "training"]);

export function StepCard({ step }: { step: OnboardingStep }) {
  const router = useRouter();
  const config = STEP_CONFIG[step.stepType] || {
    icon: Shield,
    label: step.stepType,
    description: "",
  };
  const badge = STATUS_BADGE[step.status] || STATUS_BADGE.pending;
  const actionLabel = getActionLabel(step.status);
  const Icon = config.icon;
  const isComplete = step.status === "complete";
  const isDisabled = step.status === "blocked" || step.status === "pending_review";
  const isNavigable = NAVIGABLE_STEP_TYPES.has(step.stepType);

  const handleAction = () => {
    if (DOCUMENT_STEP_TYPES.has(step.stepType)) {
      router.push(`/provider/onboarding/documents?stepId=${step.id}&type=${step.stepType}`);
    } else if (step.stepType === "training") {
      router.push("/provider/onboarding/training");
    }
  };

  return (
    <Card
      className={`transition-colors ${isDisabled ? "opacity-60" : "hover:border-primary/50"}`}
    >
      <CardContent className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            isComplete
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isComplete ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">{config.label}</h3>
            <Badge variant={badge.variant}>{badge.text}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{config.description}</p>
          {step.status === "rejected" && step.rejectionReason && (
            <div className="mt-2 flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{step.rejectionReason}</span>
            </div>
          )}
        </div>

        {actionLabel && !isDisabled && (
          <Button
            variant={step.status === "rejected" ? "destructive" : "outline"}
            size="sm"
            className="shrink-0"
            disabled={!isNavigable}
            onClick={handleAction}
          >
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
