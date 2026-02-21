"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2, X } from "lucide-react";

interface LogoUploadProps {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export function LogoUpload({ currentUrl, onUploaded }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Invalid file type. Use PNG, JPEG, SVG, or WebP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("File too large. Maximum 2MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/logo", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const { url } = await res.json();
        setPreview(url);
        onUploaded(url);
        toast.success("Logo uploaded");
      } else {
        const err = await res.json();
        toast.error(err.error || "Upload failed");
      }
    } catch {
      toast.error("Network error");
    }
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      <Label>Company Logo</Label>
      {preview && (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Logo preview"
            className="h-20 w-20 rounded-md border object-contain"
          />
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              onUploaded("");
            }}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {preview ? "Change Logo" : "Upload Logo"}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          PNG, JPEG, SVG, or WebP. Max 2MB.
        </p>
      </div>
    </div>
  );
}
