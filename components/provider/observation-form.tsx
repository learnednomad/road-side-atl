"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface ChecklistConfig {
  category: string;
  items: string[];
}

interface ObservationItem {
  category: string;
  description: string;
  severity: "low" | "medium" | "high";
  photoUrl?: string;
}

interface ObservationFormProps {
  bookingId: string;
  serviceId: string;
  onSubmitted?: () => void;
}

export function ObservationForm({ bookingId, serviceId, onSubmitted }: ObservationFormProps) {
  const [checklist, setChecklist] = useState<ChecklistConfig[]>([]);
  const [items, setItems] = useState<ObservationItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/provider/observations/checklist/${serviceId}`)
      .then(res => res.json())
      .then(data => {
        if (data.checklistConfig) setChecklist(data.checklistConfig);
      })
      .catch(() => {});
  }, [serviceId]);

  const addItem = () => {
    setItems([...items, { category: "", description: "", severity: "low" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ObservationItem, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      setError("Add at least one observation item.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/provider/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, items }),
      });
      if (res.status === 409) {
        setError("Observation already submitted for this booking.");
      } else if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit observation.");
      } else {
        setSubmitted(true);
        onSubmitted?.();
      }
    } catch {
      setError("Failed to submit observation.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <p className="font-medium">Observation submitted successfully.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle Observations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {checklist.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Checklist items for this service type:</p>
            <div className="flex flex-wrap gap-2">
              {checklist.map((group) =>
                group.items.map((item) => (
                  <Badge
                    key={`${group.category}-${item}`}
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => {
                      setItems([...items, { category: group.category, description: item, severity: "low" }]);
                    }}
                  >
                    {group.category}: {item}
                  </Badge>
                ))
              )}
            </div>
          </div>
        )}

        {items.map((item, index) => (
          <div key={index} className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Item {index + 1}</span>
              <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Category</Label>
                <Input
                  value={item.category}
                  onChange={(e) => updateItem(index, "category", e.target.value)}
                  placeholder="e.g., Battery, Tires"
                />
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={item.severity} onValueChange={(v) => updateItem(index, "severity", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={item.description}
                onChange={(e) => updateItem(index, "description", e.target.value)}
                placeholder="Describe the observation..."
              />
            </div>
            <div>
              <Label>Photo URL (optional)</Label>
              <Input
                type="url"
                value={item.photoUrl || ""}
                onChange={(e) => updateItem(index, "photoUrl", e.target.value)}
                placeholder="Photo URL (optional)"
              />
            </div>
          </div>
        ))}

        <Button variant="outline" onClick={addItem} className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add Observation Item
        </Button>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        <Button onClick={handleSubmit} disabled={submitting || items.length === 0} className="w-full">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit Observations
        </Button>
      </CardContent>
    </Card>
  );
}
