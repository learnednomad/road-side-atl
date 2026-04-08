"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, ExternalLink, RefreshCw } from "lucide-react";

interface DocumentCardProps {
  document: {
    id: string;
    originalFileName: string;
    documentType: string;
    status: string;
    rejectionReason: string | null;
    createdAt: string;
    fileSize: number;
  };
  onReupload?: () => void;
  onView?: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pending_review: { label: "Pending Review", variant: "secondary", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  approved: { label: "Approved", variant: "default", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentCard({ document, onReupload, onView }: DocumentCardProps) {
  const config = statusConfig[document.status] || statusConfig.pending_review;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{document.originalFileName}</p>
              <Badge variant={config.variant} className={config.className}>{config.label}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{formatFileSize(document.fileSize)}</span>
              <span>&middot;</span>
              <span>{new Date(document.createdAt).toLocaleDateString()}</span>
            </div>
            {document.status === "rejected" && document.rejectionReason && (
              <p className="text-sm text-destructive mt-2">
                Reason: {document.rejectionReason}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              {onView && (
                <Button variant="ghost" size="sm" onClick={onView}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  View
                </Button>
              )}
              {document.status === "rejected" && onReupload && (
                <Button variant="outline" size="sm" onClick={onReupload}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Re-upload
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
