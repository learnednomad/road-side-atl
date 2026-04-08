"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentReviewModal } from "./document-review-modal";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText, CheckCircle2, Clock, AlertCircle, XCircle, Shield } from "lucide-react";

interface PipelineProvider {
  id: string;
  name: string;
  email: string;
  status: string;
  userId: string | null;
  completedSteps: number;
  totalSteps: number;
  createdAt: string;
}

interface OnboardingStep {
  id: string;
  providerId: string;
  stepType: string;
  status: string;
  completedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

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

export function OnboardingDetailPanel({
  provider,
  onBack,
}: {
  provider: PipelineProvider;
  onBack: () => void;
}) {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [documents, setDocuments] = useState<Record<string, DocumentInfo[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<DocumentInfo | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isActivating, setIsActivating] = useState(false);

  const fetchData = useCallback(async () => {
    const [detailRes, docsRes] = await Promise.all([
      fetch(`/api/admin/providers/${provider.id}`),
      fetch(`/api/admin/providers/${provider.id}/documents`),
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
  }, [provider.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void fetchData();
  }, [fetchData]);

  const handleActivate = async () => {
    setIsActivating(true);
    const res = await fetch(`/api/admin/providers/${provider.id}/activate`, { method: "POST" });
    if (res.ok) {
      toast.success(`${provider.name} has been activated`);
      onBack();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to activate provider");
      fetchData();
    }
    setIsActivating(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    const res = await fetch(`/api/admin/providers/${provider.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason.trim() }),
    });
    if (res.ok) {
      toast.success(`${provider.name} has been rejected`);
      setShowRejectDialog(false);
      onBack();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to reject provider");
      fetchData();
    }
  };

  const allDocsFlat = Object.values(documents).flat();
  const docStepTypes = ["insurance", "certifications"];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pipeline
          </Button>
          <h2 className="text-xl font-bold">{provider.name}</h2>
          <Badge variant="secondary">{provider.status}</Badge>
        </div>
        {provider.status === "pending_review" && (
          <div className="flex gap-2">
            <Button onClick={handleActivate} disabled={isActivating} className="bg-green-600 hover:bg-green-700">
              Activate
            </Button>
            <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>
              Reject
            </Button>
          </div>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        <span>{provider.email}</span>
        <span className="mx-2">·</span>
        <span>Applied {new Date(provider.createdAt).toLocaleDateString()}</span>
        <span className="mx-2">·</span>
        <span>{provider.completedSteps}/{provider.totalSteps} steps complete</span>
      </div>

      <div className="space-y-4">
        {STEP_ORDER.map((stepType) => {
          const step = steps.find((s) => s.stepType === stepType);
          const stepStatus = step?.status || "pending";
          const config = STATUS_CONFIG[stepStatus] || STATUS_CONFIG.pending;
          const Icon = config.icon;
          const hasDocuments = docStepTypes.includes(stepType);
          const stepDocs = hasDocuments ? allDocsFlat.filter((d) => d.documentType === stepType || (step && d.onboardingStepId === step.id)) : [];

          return (
            <Card key={stepType}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <CardTitle className="text-sm font-medium">
                      {STEP_LABELS[stepType]}
                    </CardTitle>
                  </div>
                  <Badge
                    variant={stepStatus === "complete" ? "default" : stepStatus === "rejected" ? "destructive" : "secondary"}
                  >
                    {config.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {step?.completedAt && (
                  <p className="text-xs text-muted-foreground">
                    Completed {new Date(step.completedAt).toLocaleDateString()}
                  </p>
                )}
                {step?.rejectionReason && (
                  <p className="mt-1 text-xs text-red-600">
                    Reason: {step.rejectionReason}
                  </p>
                )}

                {hasDocuments && stepDocs.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Documents ({stepDocs.length})</p>
                    {stepDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex cursor-pointer items-center justify-between rounded-md border p-2 transition-colors hover:bg-muted/50"
                        onClick={() => setSelectedDocument(doc)}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-medium">{doc.originalFileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {(doc.fileSize / 1024).toFixed(1)} KB · {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {doc.status.replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {hasDocuments && stepDocs.length === 0 && stepStatus !== "complete" && (
                  <p className="mt-2 text-xs text-muted-foreground">No documents uploaded yet.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DocumentReviewModal
        document={selectedDocument}
        open={!!selectedDocument}
        onOpenChange={(open) => { if (!open) setSelectedDocument(null); }}
        onReviewed={fetchData}
      />

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {provider.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reject the provider&apos;s application. They will need to reapply.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Enter rejection reason (required)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              className="bg-destructive text-destructive-foreground"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
