"use client";

import { Button } from "@/components/ui/button";
import { Camera, Send, Loader2 } from "lucide-react";

interface DocumentPreviewProps {
  previewUrl: string;
  fileName: string;
  onRetake: () => void;
  onSubmit: () => void;
  uploading: boolean;
}

export function DocumentPreview({ previewUrl, fileName, onRetake, onSubmit, uploading }: DocumentPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="relative rounded-lg overflow-hidden border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL */}
        <img
          src={previewUrl}
          alt={`Preview of ${fileName}`}
          className="w-full h-auto max-h-[400px] object-contain"
        />
      </div>
      <p className="text-sm text-muted-foreground text-center truncate">{fileName}</p>
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onRetake}
          disabled={uploading}
        >
          <Camera className="h-4 w-4 mr-2" />
          Retake
        </Button>
        <Button
          className="flex-1"
          onClick={onSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
