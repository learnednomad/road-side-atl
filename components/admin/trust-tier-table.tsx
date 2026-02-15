"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Settings,
  Loader2,
} from "lucide-react";

interface Customer {
  id: string;
  name: string | null;
  email: string | null;
  trustTier: number;
  cleanTransactionCount: number;
  role: string;
  createdAt: string | Date;
}

interface TrustTierTableProps {
  customers: Customer[];
  total: number;
  page: number;
  totalPages: number;
  promotionThreshold: number;
}

export function TrustTierTable({
  customers: initialCustomers,
  total: initialTotal,
  page: initialPage,
  totalPages: initialTotalPages,
  promotionThreshold: initialThreshold,
}: TrustTierTableProps) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [threshold, setThreshold] = useState(initialThreshold);
  const [thresholdInput, setThresholdInput] = useState(String(initialThreshold));
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "20");
    if (searchDebounced) params.set("search", searchDebounced);

    const res = await fetch(`/api/admin/trust-tier?${params}`);
    if (res.ok) {
      const data = await res.json();
      setCustomers(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    }
  }, [page, searchDebounced]);

  const [hasInteracted, setHasInteracted] = useState(false);
  useEffect(() => {
    if (hasInteracted) {
      fetchCustomers();
    }
  }, [fetchCustomers, hasInteracted]);

  function handleSearchChange(value: string) {
    setHasInteracted(true);
    setSearch(value);
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    setHasInteracted(true);
    setPage(newPage);
  }

  async function updateTier(userId: string, newTier: number) {
    setUpdatingUser(userId);
    const res = await fetch(`/api/admin/trust-tier/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trustTier: newTier }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCustomers((prev) =>
        prev.map((c) => (c.id === userId ? { ...c, ...updated } : c))
      );
      toast.success(`Customer ${newTier === 2 ? "promoted" : "demoted"} to Tier ${newTier}`);
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || "Failed to update tier");
    }
    setUpdatingUser(null);
  }

  async function saveThreshold() {
    const value = parseInt(thresholdInput, 10);
    if (isNaN(value) || value < 1 || value > 100) {
      toast.error("Threshold must be between 1 and 100");
      return;
    }
    setSavingThreshold(true);
    const res = await fetch("/api/admin/trust-tier/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotionThreshold: value }),
    });
    if (res.ok) {
      const data = await res.json();
      setThreshold(data.promotionThreshold);
      toast.success("Promotion threshold updated");
    } else {
      toast.error("Failed to update threshold");
    }
    setSavingThreshold(false);
  }

  return (
    <div className="space-y-6">
      {/* Threshold Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Promotion Threshold
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Customers are auto-promoted to Tier 2 after
            </div>
            <Input
              type="number"
              min={1}
              max={100}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              className="w-20"
            />
            <div className="text-sm text-muted-foreground">
              clean transactions (current: {threshold})
            </div>
            <Button
              size="sm"
              onClick={saveThreshold}
              disabled={savingThreshold || parseInt(thresholdInput) === threshold}
            >
              {savingThreshold ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Changing the threshold only affects future promotions. Existing Tier 1 customers will not be auto-promoted.
          </p>
        </CardContent>
      </Card>

      {/* Customer Tier Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {total} Customer{total !== 1 ? "s" : ""}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No customers found.
            </p>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Tier</TableHead>
                      <TableHead className="text-center">Clean Txns</TableHead>
                      <TableHead className="text-center">Payment Methods</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          {customer.name || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {customer.email}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={customer.trustTier >= 2 ? "default" : "secondary"}
                          >
                            Tier {customer.trustTier}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {customer.cleanTransactionCount}
                          {customer.trustTier === 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              / {threshold}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {customer.trustTier >= 2
                            ? "Cash, CashApp, Zelle, Stripe"
                            : "Cash, CashApp, Zelle"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {customer.trustTier === 1 ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={updatingUser === customer.id}
                                  >
                                    {updatingUser === customer.id ? (
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    ) : (
                                      <ArrowUp className="mr-1 h-3 w-3" />
                                    )}
                                    Promote
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Promote to Tier 2</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Promote {customer.name || customer.email} to Tier 2? They will gain access to Stripe payments.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => updateTier(customer.id, 2)}>
                                      Promote
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={updatingUser === customer.id}
                                  >
                                    {updatingUser === customer.id ? (
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    ) : (
                                      <ArrowDown className="mr-1 h-3 w-3" />
                                    )}
                                    Demote
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Demote to Tier 1</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Demote {customer.name || customer.email} to Tier 1? They will lose access to Stripe payments.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => updateTier(customer.id, 1)}>
                                      Demote
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
