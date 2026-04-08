"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentReviewModal } from "@/components/admin/document-review-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, AlertCircle, XCircle, Shield, FileText } from "lucide-react";

interface DocumentInfo {
  id: string;
  providerId: string;
  documentType: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  status: string;
  rejectionReason: string | null;
  downloadUrl: string;
  createdAt: string;
  reviewedAt: string | null;
  onboardingStepId: string;
}

const STEP_ORDER = ["background_check", "insurance", "certifications", "training", "stripe_connect"];
const STEP_LABELS: Record<string, string> = {
  background_check: "Background Check",
  insurance: "Insurance",
  certifications: "Certifications",
  training: "Training",
  stripe_connect: "Stripe Connect",
};

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-gray-500", label: "Not Started" },
  draft: { icon: Clock, color: "text-gray-500", label: "Not Started" },
  in_progress: { icon: AlertCircle, color: "text-blue-500", label: "In Progress" },
  pending_review: { icon: Shield, color: "text-yellow-500", label: "Pending Review" },
  complete: { icon: CheckCircle2, color: "text-green-500", label: "Approved" },
  rejected: { icon: XCircle, color: "text-red-500", label: "Rejected" },
  blocked: { icon: XCircle, color: "text-gray-400", label: "Blocked" },
};

interface OnboardingStep {
  id: string;
  stepType: string;
  status: string;
  completedAt: string | null;
  rejectionReason: string | null;
}

export function OnboardingSection({ providerId }: { providerId: string }) {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [documents, setDocuments] = useState<Record<string, DocumentInfo[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<DocumentInfo | null>(null);

  const fetchData = useCallback(async () => {
    const [detailRes, docsRes] = await Promise.all([
      fetch(`/api/admin/providers/${providerId}`),
      fetch(`/api/admin/providers/${providerId}/documents`),
    ]);

    if (detailRes.ok) {
      const data = await detailRes.json();
      setSteps(data.onboardingSteps || []);
    }

    if (docsRes.ok) {
      const data = await docsRes.json();
      setDocuments(data.documents || {});
    }

    setIsLoading(false);
  }, [providerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void fetchData();
  }, [fetchData]);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  const allDocsFlat = Object.values(documents).flat();
  const completedCount = steps.filter((s) => s.status === "complete").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Onboarding Progress</span>
          <Badge variant="secondary">{completedCount}/{steps.length || 5} steps</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {STEP_ORDER.map((stepType) => {
          const step = steps.find((s) => s.stepType === stepType);
          const stepStatus = step?.status || "pending";
          const config = STATUS_CONFIG[stepStatus] || STATUS_CONFIG.pending;
          const Icon = config.icon;
          const hasDocuments = stepType === "insurance" || stepType === "certifications";
          const stepDocs = hasDocuments ? allDocsFlat.filter((d) => step && d.onboardingStepId === step.id) : [];

          return (
            <div key={stepType} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-sm font-medium">{STEP_LABELS[stepType]}</span>
                </div>
                <Badge
                  variant={stepStatus === "complete" ? "default" : stepStatus === "rejected" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {config.label}
                </Badge>
              </div>

              {hasDocuments && stepDocs.length > 0 && (
                <div className="mt-2 space-y-1">
                  {stepDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs transition-colors hover:bg-muted/50"
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{doc.originalFileName}</span>
                      </div>
                      <Badge
                        variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {doc.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      <DocumentReviewModal
        document={selectedDocument}
        open={!!selectedDocument}
        onOpenChange={(open) => { if (!open) setSelectedDocument(null); }}
        onReviewed={fetchData}
      />
    </Card>
  );
}
