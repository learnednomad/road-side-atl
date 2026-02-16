"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STORM_MODE_PRIORITY } from "@/lib/constants";
import { CloudLightning, Power, Pencil, Check, X } from "lucide-react";

interface TimeBlockConfig {
  id: string;
  name: string;
  startHour: number;
  endHour: number;
  multiplier: number;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface StormModeStatus {
  active: boolean;
  template: TimeBlockConfig | null;
}

export function StormModeToggle() {
  const [templates, setTemplates] = useState<TimeBlockConfig[]>([]);
  const [status, setStatus] = useState<StormModeStatus>({ active: false, template: null });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMultiplier, setEditMultiplier] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, configsRes] = await Promise.all([
        fetch("/api/admin/pricing/storm-mode/status"),
        fetch("/api/admin/pricing"),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }

      if (configsRes.ok) {
        const allConfigs: TimeBlockConfig[] = await configsRes.json();
        setTemplates(allConfigs.filter((c) => c.priority >= STORM_MODE_PRIORITY));
      }
    } catch {
      toast.error("Failed to load Storm Mode data");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleActivate(templateId: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/pricing/storm-mode/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });

      if (res.ok) {
        toast.success("Storm Mode activated");
        await fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to activate Storm Mode");
      }
    } catch {
      toast.error("Failed to activate Storm Mode");
    }
    setActionLoading(false);
  }

  async function handleDeactivate() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/pricing/storm-mode/deactivate", {
        method: "POST",
      });

      if (res.ok) {
        toast.success("Storm Mode deactivated");
        await fetchData();
      } else {
        toast.error("Failed to deactivate Storm Mode");
      }
    } catch {
      toast.error("Failed to deactivate Storm Mode");
    }
    setActionLoading(false);
  }

  async function handleSaveMultiplier(templateId: string) {
    const multiplierBp = Math.round(parseFloat(editMultiplier) * 10000);
    if (isNaN(multiplierBp) || multiplierBp < 1 || multiplierBp > 50000) {
      toast.error("Multiplier must be between 0.01x and 5.0x");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/pricing/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplier: multiplierBp }),
      });

      if (res.ok) {
        toast.success("Multiplier updated");
        setEditingId(null);
        setEditMultiplier("");
        await fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update multiplier");
      }
    } catch {
      toast.error("Failed to update multiplier");
    }
    setActionLoading(false);
  }

  function startEditing(template: TimeBlockConfig) {
    setEditingId(template.id);
    setEditMultiplier((template.multiplier / 10000).toFixed(2));
  }

  function cancelEditing() {
    setEditingId(null);
    setEditMultiplier("");
  }

  function formatMultiplier(bp: number): string {
    return (bp / 10000).toFixed(2) + "x";
  }

  function formatPercentage(bp: number): string {
    return Math.round(bp / 100) + "%";
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudLightning className="h-5 w-5" />
            Storm Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CloudLightning className={cn("h-5 w-5", status.active && "text-destructive")} />
            Storm Mode
          </CardTitle>
          {status.active && (
            <Badge variant="destructive" className="text-sm">
              ACTIVE — {status.template?.name}
            </Badge>
          )}
        </div>
        {status.active && status.template && (
          <p className="text-sm text-muted-foreground">
            Surge pricing at {formatMultiplier(status.template.multiplier)} ({formatPercentage(status.template.multiplier)}) is overriding all regular time-block pricing.
          </p>
        )}
        {!status.active && (
          <p className="text-sm text-muted-foreground">
            Select a template to activate surge pricing during severe weather or events.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {status.active && (
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={handleDeactivate}
              disabled={actionLoading}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Power className="mr-2 h-4 w-4" />
              {actionLoading ? "Deactivating..." : "Deactivate Storm Mode"}
            </Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const isActive = status.active && status.template?.id === template.id;
            const isEditing = editingId === template.id;

            return (
              <Card
                key={template.id}
                className={cn(
                  "transition-colors",
                  isActive && "border-destructive bg-destructive/5",
                )}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{template.name}</h3>
                    {isActive && (
                      <Badge variant="destructive" className="text-xs">Active</Badge>
                    )}
                  </div>

                  <div className="mb-4">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="5.0"
                          value={editMultiplier}
                          onChange={(e) => setEditMultiplier(e.target.value)}
                          className="w-24"
                          placeholder="1.50"
                        />
                        <span className="text-sm text-muted-foreground">x</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleSaveMultiplier(template.id)}
                          disabled={actionLoading}
                          className="h-8 w-8"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={cancelEditing}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{formatMultiplier(template.multiplier)}</span>
                        <span className="text-sm text-muted-foreground">({formatPercentage(template.multiplier)})</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditing(template)}
                          disabled={actionLoading}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {!isActive && (
                    <Button
                      onClick={() => handleActivate(template.id)}
                      disabled={actionLoading}
                      variant="default"
                      className="w-full"
                    >
                      <CloudLightning className="mr-2 h-4 w-4" />
                      {actionLoading ? "Activating..." : "Activate"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {templates.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No Storm Mode templates found. Run database seed to create default templates.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
