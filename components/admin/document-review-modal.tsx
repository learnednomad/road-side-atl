"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ZoomIn, ZoomOut, RotateCw, Check, X } from "lucide-react";

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
  onboardingStepId?: string;
}

export function DocumentReviewModal({
  document,
  open,
  onOpenChange,
  onReviewed,
}: {
  document: DocumentInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const imageRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => Math.max(0.5, Math.min(5, prev + (e.deltaY > 0 ? -0.1 : 0.1))));
  }, []);

  const handleReview = async (status: "approved" | "rejected") => {
    if (!document) return;
    if (status === "rejected" && !rejectionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    setIsSubmitting(true);
    const res = await fetch(
      `/api/admin/providers/${document.providerId}/documents/${document.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "rejected" && { rejectionReason: rejectionReason.trim() }),
        }),
      }
    );

    if (res.ok) {
      toast.success(`Document ${status}`);
      setShowRejectForm(false);
      setRejectionReason("");
      setScale(1);
      onOpenChange(false);
      onReviewed();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to review document");
    }
    setIsSubmitting(false);
  };

  if (!document) return null;

  const isReviewed = document.status !== "pending_review";
  const fileSizeKB = (document.fileSize / 1024).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setScale(1); setShowRejectForm(false); setRejectionReason(""); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Document Review
            <StatusBadge status={document.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{document.originalFileName}</span>
          <span>{fileSizeKB} KB</span>
          <span>{document.mimeType}</span>
          <span>Uploaded {new Date(document.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(5, s + 0.25))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setScale(1)}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        <div
          ref={imageRef}
          className="flex-1 overflow-auto rounded-md border bg-muted/50"
          onWheel={handleWheel}
          style={{ minHeight: "300px", maxHeight: "50vh" }}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={document.downloadUrl}
              alt={document.originalFileName}
              style={{ transform: `scale(${scale})`, transformOrigin: "center", transition: "transform 0.1s" }}
              className="max-w-full"
              draggable={false}
            />
          </div>
        </div>

        {isReviewed ? (
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">
              This document has been {document.status}.
            </p>
            {document.rejectionReason && (
              <p className="mt-1 text-sm text-muted-foreground">
                Reason: {document.rejectionReason}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {showRejectForm ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Enter rejection reason (required)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleReview("rejected")}
                    disabled={isSubmitting || !rejectionReason.trim()}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Confirm Rejection
                  </Button>
                  <Button variant="outline" onClick={() => { setShowRejectForm(false); setRejectionReason(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => handleReview("approved")} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button variant="destructive" onClick={() => setShowRejectForm(true)} disabled={isSubmitting}>
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    pending_review: "secondary",
    approved: "default",
    rejected: "destructive",
  };
  return <Badge variant={variants[status] || "secondary"}>{status.replaceAll("_", " ")}</Badge>;
}
