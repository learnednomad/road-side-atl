"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentUploader } from "@/components/onboarding/document-uploader";
import { DocumentCard } from "@/components/onboarding/document-card";
import { useWS } from "@/components/providers/websocket-provider";
import { Loader2, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface Document {
  id: string;
  originalFileName: string;
  documentType: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  fileSize: number;
}

interface StepInfo {
  id: string;
  stepType: string;
  status: string;
}

const DOCUMENT_GUIDANCE: Record<string, { title: string; guidance: string }> = {
  insurance: {
    title: "Insurance Documents",
    guidance:
      "Upload a clear photo of your commercial auto insurance policy. Make sure the policy number, coverage dates, and insured name are visible.",
  },
  certifications: {
    title: "Certifications & Licenses",
    guidance:
      "Upload your tow operator license, ASE certifications, or other relevant credentials. Ensure the document is fully visible and not expired.",
  },
  vehicle_doc: {
    title: "Vehicle Documentation",
    guidance:
      "Upload your vehicle registration, inspection report, or title. All text must be clearly readable.",
  },
};

function DocumentsContent() {
  const searchParams = useSearchParams();
  const stepId = searchParams.get("stepId");
  const stepType = searchParams.get("type");
  const uploadSectionRef = useRef<HTMLDivElement>(null);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [step, setStep] = useState<StepInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { lastEvent } = useWS();

  const docTypeKey = stepType === "certifications" ? "certifications" : stepType || "insurance";
  const config = DOCUMENT_GUIDANCE[docTypeKey] || DOCUMENT_GUIDANCE.insurance;

  const fetchData = useCallback(async () => {
    if (!stepId) return;
    try {
      const [dashRes, docsRes] = await Promise.all([
        fetch("/api/onboarding/dashboard"),
        fetch("/api/onboarding/documents"),
      ]);

      if (!dashRes.ok || !docsRes.ok) {
        throw new Error("Failed to load data");
      }

      const dashData = await dashRes.json();
      const docsData = await docsRes.json();

      const foundStep = dashData.steps?.find((s: StepInfo) => s.id === stepId);
      if (foundStep) setStep(foundStep);

      const stepDocs = docsData.documents?.[stepId] || [];
      setDocuments(stepDocs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [stepId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch on relevant WebSocket events
  useEffect(() => {
    if (!lastEvent) return;
    if (
      lastEvent.type === "onboarding:document_reviewed" ||
      lastEvent.type === "onboarding:step_updated"
    ) {
      fetchData();
    }
  }, [lastEvent, fetchData]);

  const handleUploadComplete = () => {
    fetchData();
  };

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmitForReview = async () => {
    if (!stepId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/steps/${stepId}/submit`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit for review");
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      const res = await fetch(`/api/onboarding/documents/${documentId}/url`);
      if (!res.ok) throw new Error("Failed to get document URL");
      const { downloadUrl } = await res.json();
      window.open(downloadUrl, "_blank");
    } catch {
      setError("Failed to open document");
    }
  };

  if (!stepId || !stepType) {
    return (
      <div className="space-y-4">
        <Link href="/provider/onboarding">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Onboarding
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Invalid page parameters. Please navigate from the onboarding dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isStepSubmitted = step?.status === "in_progress" || step?.status === "complete" || step?.status === "pending_review";
  const isStepComplete = step?.status === "complete";
  const hasDocuments = documents.length > 0;
  const pendingDocs = documents.filter((d) => d.status === "pending_review");
  const rejectedDocs = documents.filter((d) => d.status === "rejected");
  const approvedDocs = documents.filter((d) => d.status === "approved");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/provider/onboarding">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{config.title}</h1>
        </div>
        {step && (
          <Badge
            variant={
              isStepComplete
                ? "default"
                : step.status === "rejected"
                  ? "destructive"
                  : "secondary"
            }
          >
            {isStepComplete
              ? "Approved"
              : step.status === "in_progress"
                ? "Under Review"
                : step.status === "rejected"
                  ? "Rejected"
                  : "Not Submitted"}
          </Badge>
        )}
      </div>

      {/* Completion state */}
      {isStepComplete && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            <p className="text-center text-muted-foreground">
              All documents for this step have been approved.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upload section — show if step not yet submitted or has rejected docs */}
      {(!isStepSubmitted || rejectedDocs.length > 0) && (
        <Card ref={uploadSectionRef}>
          <CardHeader>
            <CardTitle className="text-lg">Upload Document</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUploader
              documentType={docTypeKey}
              stepId={stepId}
              guidance={config.guidance}
              onUploadComplete={handleUploadComplete}
            />
          </CardContent>
        </Card>
      )}

      {/* Document list */}
      {hasDocuments && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            Uploaded Documents ({documents.length})
          </h2>
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onView={() => handleViewDocument(doc.id)}
              onReupload={scrollToUpload}
            />
          ))}
        </div>
      )}

      {/* Submit for review button */}
      {hasDocuments && !isStepSubmitted && (
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmitForReview}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit for Review
            </>
          )}
        </Button>
      )}

      {/* Status summary */}
      {isStepSubmitted && !isStepComplete && hasDocuments && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <p className="text-sm font-medium">Review Status</p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              {approvedDocs.length > 0 && (
                <span className="text-green-600">{approvedDocs.length} approved</span>
              )}
              {pendingDocs.length > 0 && (
                <span>{pendingDocs.length} pending review</span>
              )}
              {rejectedDocs.length > 0 && (
                <span className="text-destructive">{rejectedDocs.length} rejected</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DocumentsContent />
    </Suspense>
  );
}
