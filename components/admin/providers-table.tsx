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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProviderForm } from "./provider-form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Mail, Loader2 } from "lucide-react";
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
  userId: string | null;
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

const PAGE_SIZE = 10;

export function ProvidersTable({ providers: initialProviders }: { providers: Provider[] }) {
  const [providers, setProviders] = useState(initialProviders);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [inviting, setInviting] = useState<string | null>(null);

  const filtered = providers.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.phone.includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  async function sendInvite(id: string) {
    setInviting(id);
    try {
      const res = await fetch(`/api/admin/providers/${id}/invite`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Invite sent successfully");
      } else {
        toast.error(data.error || "Failed to send invite");
      }
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setInviting(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search providers..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-64 pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} provider{filtered.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
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
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No providers found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((provider) => (
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
                      {!provider.userId && (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="Send invite"
                          onClick={() => sendInvite(provider.id)}
                          disabled={inviting === provider.id}
                        >
                          {inviting === provider.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Mail className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      <Dialog
                        open={editOpen === provider.id}
                        onOpenChange={(open) => setEditOpen(open ? provider.id : null)}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" aria-label="Edit provider">
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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" aria-label="Deactivate provider">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deactivate Provider</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to deactivate {provider.name}? They will stop receiving new job assignments.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProvider(provider.id)}>
                                Deactivate
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
