"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";
import { Percent, Pencil, X, Check } from "lucide-react";

interface ServiceCommission {
  id: string;
  name: string;
  slug: string;
  category: string;
  basePrice: number;
  commissionRate: number;
  active: boolean;
}

export function CommissionConfigTable() {
  const [services, setServices] = useState<ServiceCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchServices() {
    try {
      const res = await fetch("/api/admin/services/commission");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setServices(data as ServiceCommission[]);
      setFetchError(false);
    } catch {
      setFetchError(true);
      toast.error("Failed to load commission rates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchServices();
  }, []);

  function startEdit(service: ServiceCommission) {
    setEditingId(service.id);
    setEditValue((service.commissionRate / 100).toString());
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function saveEdit(id: string) {
    const percentage = parseFloat(editValue);
    if (isNaN(percentage) || percentage < 1 || percentage > 50) {
      toast.error("Commission rate must be between 1% and 50%");
      return;
    }

    const commissionRate = Math.round(percentage * 100);

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/services/${id}/commission`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      toast.success("Commission rate updated");
      setEditingId(null);
      fetchServices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update commission rate");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4" />
            Service Commission Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading commission rates...</p>
        </CardContent>
      </Card>
    );
  }

  if (fetchError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4" />
            Service Commission Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load commission rates.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => { setLoading(true); fetchServices(); }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-4 w-4" />
          Service Commission Rates
        </CardTitle>
        <CardDescription>
          The commission rate is the platform's cut. Providers receive the remainder.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </h3>
              <div className="space-y-2">
                {services
                  .filter((s) => s.category === category)
                  .map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{service.name}</p>
                          <Badge variant={service.active ? "default" : "secondary"}>
                            {service.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Base: {formatPrice(service.basePrice)}</span>
                          {editingId === service.id ? (
                            <div className="flex items-center gap-1">
                              <span>Platform:</span>
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-7 w-20 text-xs"
                                step="1"
                                min="1"
                                max="50"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(service.id);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                              <span>%</span>
                            </div>
                          ) : (
                            <>
                              <span>Platform: {(service.commissionRate / 100).toFixed(1)}%</span>
                              <span>Provider: {((10000 - service.commissionRate) / 100).toFixed(1)}%</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {editingId === service.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => saveEdit(service.id)}
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
                            onClick={() => startEdit(service)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <p className="text-sm text-muted-foreground">No services found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
