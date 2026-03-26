"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DocumentPreview } from "./document-preview";
import { Camera, Upload } from "lucide-react";

interface DocumentUploaderProps {
  documentType: string;
  stepId: string;
  guidance: string;
  onUploadComplete: () => void;
}

async function compressImage(file: File, targetSizeKB: number = 2048): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      const maxDimension = 2048;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            if (blob.size <= targetSizeKB * 1024 || quality <= 0.3) {
              resolve(blob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          "image/jpeg",
          quality,
        );
      };
      tryCompress();
    };
    img.src = objectUrl;
  });
}

async function uploadToS3(url: string, blob: Blob, mimeType: string): Promise<void> {
  const delays = [1000, 3000, 9000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": mimeType },
      });
      if (res.ok) return;
      throw new Error(`Upload failed: ${res.status}`);
    } catch (error) {
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      } else {
        throw error;
      }
    }
  }
}

export function DocumentUploader({ documentType, stepId, guidance, onUploadComplete }: DocumentUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a PNG, JPEG, or WebP image.");
      return;
    }

    // Validate raw file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum size is 10MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      // Compress image (always outputs JPEG for optimal size)
      const compressed = await compressImage(selectedFile);
      const mimeType = "image/jpeg";
      // Ensure filename extension matches actual content type after compression
      const baseName = selectedFile.name.replace(/\.[^.]+$/, "");
      const fileName = `${baseName}.jpg`;

      // Get presigned upload URL
      const urlRes = await fetch("/api/onboarding/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          mimeType,
          fileName,
        }),
      });

      if (!urlRes.ok) {
        const data = await urlRes.json();
        throw new Error(data.error || "Failed to get upload URL");
      }

      const { uploadUrl, s3Key } = await urlRes.json();

      // Upload to S3 with retry
      await uploadToS3(uploadUrl, compressed, mimeType);

      // Create document record
      const docRes = await fetch("/api/onboarding/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key,
          documentType,
          originalFileName: fileName,
          fileSize: compressed.size,
          mimeType,
          onboardingStepId: stepId,
        }),
      });

      if (!docRes.ok) {
        const data = await docRes.json();
        throw new Error(data.error || "Failed to create document record");
      }

      // Reset and notify parent
      handleRetake();
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{guidance}</p>

      {previewUrl && selectedFile ? (
        <DocumentPreview
          previewUrl={previewUrl}
          fileName={selectedFile.name}
          onRetake={handleRetake}
          onSubmit={handleSubmit}
          uploading={uploading}
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="lg"
            className="w-full h-24 border-dashed"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-2">
              <Camera className="h-6 w-6" />
              <span>Take Photo or Choose File</span>
            </div>
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
          {error.includes("Upload failed") && (
            <Button variant="outline" size="sm" className="mt-2" onClick={handleSubmit}>
              <Upload className="h-4 w-4 mr-2" />
              Retry Upload
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
