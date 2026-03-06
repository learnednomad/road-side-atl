"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface TaxIdManagerProps {
  providerId: string;
}

function maskTaxId(taxId: string): string {
  if (taxId.includes("-") && taxId.length === 11) {
    // SSN format: XXX-XX-XXXX → ***-**-1234
    return `***-**-${taxId.slice(-4)}`;
  }
  if (taxId.includes("-") && taxId.length === 10) {
    // EIN format: XX-XXXXXXX → **-***1234
    return `**-***${taxId.slice(-4)}`;
  }
  return `****${taxId.slice(-4)}`;
}

export function TaxIdManager({ providerId }: TaxIdManagerProps) {
  const [taxId, setTaxId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function fetchTaxId() {
    setLoading(true);
    const res = await fetch(`/api/admin/providers/${providerId}/tax-id`);
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setTaxId(data.taxId);
      setFetched(true);
      setRevealed(true);
    } else {
      toast.error("Failed to fetch Tax ID");
    }
  }

  async function handleSave() {
    // Validate format
    const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
    const einRegex = /^\d{2}-\d{7}$/;
    if (!ssnRegex.test(editValue) && !einRegex.test(editValue)) {
      toast.error("Format must be SSN (XXX-XX-XXXX) or EIN (XX-XXXXXXX)");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/admin/providers/${providerId}/tax-id`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxId: editValue }),
    });
    setLoading(false);
    if (res.ok) {
      setTaxId(editValue);
      setEditing(false);
      setEditValue("");
      toast.success("Tax ID saved");
    } else {
      toast.error("Failed to save Tax ID");
    }
  }

  if (editing) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tax ID (SSN/EIN)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="XXX-XX-XXXX or XX-XXXXXXX"
            maxLength={11}
            autoComplete="off"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              <Save className="mr-1 h-3 w-3" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Tax ID (SSN/EIN)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          {!fetched ? (
            <span className="text-sm text-muted-foreground">Hidden</span>
          ) : taxId ? (
            <span className="font-mono text-sm">
              {revealed ? taxId : maskTaxId(taxId)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Not set</span>
          )}
          <div className="flex gap-1">
            {!fetched ? (
              <Button size="sm" variant="ghost" onClick={fetchTaxId} disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
              </Button>
            ) : taxId ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRevealed(!revealed)}
              >
                {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => { setEditing(true); setEditValue(taxId || ""); }}>
              {taxId ? "Edit" : "Set"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
