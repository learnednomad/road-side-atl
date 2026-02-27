"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { STORM_MODE_PRIORITY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Clock, Pencil, X, Check } from "lucide-react";

interface TimeBlockConfig {
  id: string;
  name: string;
  startHour: number;
  endHour: number;
  multiplier: number;
  isActive: boolean;
  priority: number;
}

export function PricingConfigTable() {
  const [configs, setConfigs] = useState<TimeBlockConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    multiplier: "",
    startHour: "",
    endHour: "",
  });
  const [saving, setSaving] = useState(false);

  async function fetchConfigs() {
    try {
      const res = await fetch("/api/admin/pricing");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const regular = (data as TimeBlockConfig[]).filter(
        (c) => c.priority < STORM_MODE_PRIORITY,
      );
      setConfigs(regular);
      setFetchError(false);
    } catch {
      setFetchError(true);
      toast.error("Failed to load pricing configs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConfigs();
  }, []);

  function startEdit(config: TimeBlockConfig) {
    setEditingId(config.id);
    setEditValues({
      multiplier: (config.multiplier / 100).toString(),
      startHour: config.startHour.toString(),
      endHour: config.endHour.toString(),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({ multiplier: "", startHour: "", endHour: "" });
  }

  async function saveEdit(id: string) {
    const multiplier = Math.round(parseFloat(editValues.multiplier) * 100);
    const startHour = parseInt(editValues.startHour, 10);
    const endHour = parseInt(editValues.endHour, 10);

    if (isNaN(multiplier) || multiplier < 1 || multiplier > 50000) {
      toast.error("Multiplier must be between 1% and 500%");
      return;
    }
    if (isNaN(startHour) || startHour < 0 || startHour > 23) {
      toast.error("Start hour must be 0-23");
      return;
    }
    if (isNaN(endHour) || endHour < 0 || endHour > 24) {
      toast.error("End hour must be 0-24");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pricing/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplier, startHour, endHour }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      toast.success("Pricing config updated");
      setEditingId(null);
      fetchConfigs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update config");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(config: TimeBlockConfig) {
    try {
      const res = await fetch(`/api/admin/pricing/${config.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !config.isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      toast.success(
        `${config.name} ${config.isActive ? "disabled" : "enabled"}`,
      );
      fetchConfigs();
    } catch {
      toast.error("Failed to toggle config status");
    }
  }

  function formatHour(hour: number): string {
    if (hour === 0 || hour === 24) return "12:00 AM";
    if (hour === 12) return "12:00 PM";
    return hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`;
  }

  function formatMultiplier(bp: number): string {
    return `${(bp / 10000).toFixed(2)}x`;
  }

  function formatPercentage(bp: number): string {
    return `${(bp / 100).toFixed(0)}%`;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Time-Block Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading pricing configs...</p>
        </CardContent>
      </Card>
    );
  }

  if (fetchError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Time-Block Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load pricing configs.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => { setLoading(true); fetchConfigs(); }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Time-Block Pricing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {configs.length === 0 && (
            <p className="text-sm text-muted-foreground">No regular pricing configs found.</p>
          )}
          {configs.map((config) => (
            <div
              key={config.id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                !config.isActive && "opacity-60",
              )}
            >
              <div className="flex items-center gap-3">
                <Badge
                  variant={config.isActive ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => toggleActive(config)}
                >
                  {config.isActive ? "Active" : "Inactive"}
                </Badge>
                <div>
                  <p className="font-medium">{config.name}</p>
                  {editingId === config.id ? (
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        type="number"
                        value={editValues.startHour}
                        onChange={(e) => setEditValues({ ...editValues, startHour: e.target.value })}
                        className="h-7 w-16 text-xs"
                        min={0}
                        max={23}
                        placeholder="Start"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="number"
                        value={editValues.endHour}
                        onChange={(e) => setEditValues({ ...editValues, endHour: e.target.value })}
                        className="h-7 w-16 text-xs"
                        min={0}
                        max={24}
                        placeholder="End"
                      />
                      <span className="text-xs text-muted-foreground">hrs,</span>
                      <Input
                        type="number"
                        value={editValues.multiplier}
                        onChange={(e) => setEditValues({ ...editValues, multiplier: e.target.value })}
                        className="h-7 w-20 text-xs"
                        step="1"
                        min="1"
                        placeholder="%"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {formatHour(config.startHour)} – {formatHour(config.endHour)} | {formatMultiplier(config.multiplier)} ({formatPercentage(config.multiplier)})
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {editingId === config.id ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => saveEdit(config.id)}
                      disabled={saving}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEdit(config)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
