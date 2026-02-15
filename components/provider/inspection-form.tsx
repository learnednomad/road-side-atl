"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface InspectionFinding {
  category: string;
  component: string;
  condition: "good" | "fair" | "poor" | "critical";
  description: string;
  measurement?: string;
  obdCode?: string;
}

interface InspectionFormProps {
  bookingId: string;
  onSubmitted?: () => void;
}

export function InspectionForm({ bookingId, onSubmitted }: InspectionFormProps) {
  const [findings, setFindings] = useState<InspectionFinding[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFinding = () => {
    setFindings([
      ...findings,
      {
        category: "",
        component: "",
        condition: "good",
        description: "",
      },
    ]);
  };

  const removeFinding = (index: number) => {
    setFindings(findings.filter((_, i) => i !== index));
  };

  const updateFinding = (
    index: number,
    field: keyof InspectionFinding,
    value: string
  ) => {
    const updated = [...findings];
    updated[index] = { ...updated[index], [field]: value };
    setFindings(updated);
  };

  const handleSubmit = async () => {
    if (findings.length === 0) {
      setError("Add at least one finding.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/inspection-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, findings }),
      });
      if (res.status === 409) {
        setError("Inspection report already submitted for this booking.");
      } else if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit report.");
      } else {
        setSubmitted(true);
        onSubmitted?.();
      }
    } catch {
      setError("Failed to submit report.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <p className="font-medium">
            Inspection report submitted successfully.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspection Findings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {findings.map((finding, index) => (
          <div key={index} className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Finding {index + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFinding(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Category</Label>
                <Input
                  value={finding.category}
                  onChange={(e) =>
                    updateFinding(index, "category", e.target.value)
                  }
                  placeholder="e.g., Engine, Brakes"
                />
              </div>
              <div>
                <Label>Component</Label>
                <Input
                  value={finding.component}
                  onChange={(e) =>
                    updateFinding(index, "component", e.target.value)
                  }
                  placeholder="e.g., Oil Filter, Brake Pads"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Condition</Label>
                <Select
                  value={finding.condition}
                  onValueChange={(v) =>
                    updateFinding(index, "condition", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>OBD Code (optional)</Label>
                <Input
                  value={finding.obdCode || ""}
                  onChange={(e) =>
                    updateFinding(index, "obdCode", e.target.value)
                  }
                  placeholder="e.g., P0300"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={finding.description}
                onChange={(e) =>
                  updateFinding(index, "description", e.target.value)
                }
                placeholder="Describe the finding..."
              />
            </div>
            <div>
              <Label>Measurement (optional)</Label>
              <Input
                value={finding.measurement || ""}
                onChange={(e) =>
                  updateFinding(index, "measurement", e.target.value)
                }
                placeholder="e.g., 3mm remaining"
              />
            </div>
          </div>
        ))}

        <Button variant="outline" onClick={addFinding} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add Finding
        </Button>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting || findings.length === 0}
          className="w-full"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Submit Inspection Report
        </Button>
      </CardContent>
    </Card>
  );
}
