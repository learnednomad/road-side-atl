"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProviderForm } from "./provider-form";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { ProviderStatus, CommissionType } from "@/lib/constants";

interface Provider {
  id: string;
  name: string;
  email: string;
  phone: string;
  commissionRate: number;
  commissionType: CommissionType;
  flatFeeAmount: number | null;
  status: ProviderStatus;
  specialties: string[] | null;
  createdAt: string;
}

function formatCommission(provider: Provider): string {
  if (provider.commissionType === "flat_per_job") {
    return `$${((provider.flatFeeAmount || 0) / 100).toFixed(2)}/job`;
  }
  return `${(provider.commissionRate / 100).toFixed(0)}%`;
}

const statusVariant: Record<ProviderStatus, "default" | "secondary" | "destructive"> = {
  active: "default",
  pending: "secondary",
  inactive: "destructive",
};

export function ProvidersTable({ providers: initialProviders }: { providers: Provider[] }) {
  const [providers, setProviders] = useState(initialProviders);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<string | null>(null);

  async function createProvider(data: any) {
    const res = await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const provider = await res.json();
      setProviders((prev) => [provider, ...prev]);
      setAddOpen(false);
      toast.success("Provider created");
    } else {
      toast.error("Failed to create provider");
    }
  }

  async function updateProvider(id: string, data: any) {
    const res = await fetch(`/api/admin/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      setEditOpen(null);
      toast.success("Provider updated");
    } else {
      toast.error("Failed to update provider");
    }
  }

  async function deleteProvider(id: string) {
    const res = await fetch(`/api/admin/providers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "inactive" as const } : p))
      );
      toast.success("Provider deactivated");
    } else {
      toast.error("Failed to deactivate provider");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {providers.length} provider{providers.length !== 1 ? "s" : ""}
        </span>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Provider</DialogTitle>
            </DialogHeader>
            <ProviderForm onSubmit={createProvider} submitLabel="Create Provider" />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No providers found.
                </TableCell>
              </TableRow>
            ) : (
              providers.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell className="text-sm">{provider.email}</TableCell>
                  <TableCell className="text-sm">{provider.phone}</TableCell>
                  <TableCell className="text-sm">
                    {formatCommission(provider)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[provider.status]}>
                      {provider.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog
                        open={editOpen === provider.id}
                        onOpenChange={(open) => setEditOpen(open ? provider.id : null)}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Edit Provider</DialogTitle>
                          </DialogHeader>
                          <ProviderForm
                            defaultValues={{
                              name: provider.name,
                              email: provider.email,
                              phone: provider.phone,
                              commissionType: provider.commissionType,
                              commissionRate: provider.commissionRate,
                              flatFeeAmount: provider.flatFeeAmount ?? 0,
                              specialties: provider.specialties ?? [],
                              status: provider.status,
                            }}
                            onSubmit={(data) => updateProvider(provider.id, data)}
                            submitLabel="Update Provider"
                          />
                        </DialogContent>
                      </Dialog>
                      {provider.status !== "inactive" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteProvider(provider.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
