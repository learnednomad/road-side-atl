"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, FlaskConical } from "lucide-react";

export function BetaModeToggle() {
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [betaActive, setBetaActive] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/beta/stats")
      .then((res) => res.json())
      .then((data) => {
        setBetaActive(data.betaActive);
        setStartDate(data.startDate);
        setEndDate(data.endDate);
      })
      .catch(() => {
        toast.error("Failed to load beta status");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(checked: boolean) {
    setToggling(true);
    try {
      const res = await fetch("/api/admin/settings/beta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: checked }),
      });

      if (res.ok) {
        setBetaActive(checked);
        toast.success(checked ? "Beta mode activated" : "Beta mode deactivated");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to toggle beta mode");
      }
    } catch {
      toast.error("Network error");
    }
    setToggling(false);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Beta Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <FlaskConical className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>Beta Mode</CardTitle>
              {betaActive ? (
                <Badge variant="default" className="bg-violet-600">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            <CardDescription>
              Enable or disable the mechanics beta program. Changes take effect immediately.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="beta-toggle" className="text-base font-medium">
              Mechanics Beta
            </Label>
            <p className="text-sm text-muted-foreground">
              {betaActive
                ? "Beta is active. Mechanic services are available to users."
                : "Beta is inactive. Mechanic services are hidden from users."}
            </p>
          </div>
          <Switch
            id="beta-toggle"
            checked={betaActive}
            onCheckedChange={handleToggle}
            disabled={toggling}
            aria-label="Toggle beta mode"
          />
        </div>

        {(startDate || endDate) && (
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {startDate && (
              <div>
                <span className="font-medium text-foreground">Start Date:</span>{" "}
                {new Date(startDate).toLocaleDateString()}
              </div>
            )}
            {endDate && (
              <div>
                <span className="font-medium text-foreground">End Date:</span>{" "}
                {new Date(endDate).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
