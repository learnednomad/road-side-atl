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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { DollarSign, Clock, Download, Users, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { exportToCSV } from "@/lib/csv";
import { formatPrice } from "@/lib/utils";

interface Payout {
  payout: {
    id: string;
    providerId: string;
    bookingId: string;
    amount: number;
    status: "pending" | "paid" | "clawback";
    payoutType: string;
    paidAt: string | null;
    createdAt: string;
  };
  provider: {
    id: string;
    name: string;
  };
  booking: {
    id: string;
    contactName: string;
  };
}

interface PayoutsTableProps {
  payouts: Payout[];
  summary: {
    totalPending: number;
    totalPaid: number;
    pendingCount: number;
    paidCount: number;
    totalClawback: number;
    clawbackCount: number;
  };
}

const PAYOUTS_PAGE_SIZE = 20;

export function PayoutsTable({ payouts: initialPayouts, summary }: PayoutsTableProps) {
  const [payouts, setPayouts] = useState(initialPayouts);
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  // Get unique providers for filter
  const providers = Array.from(
    new Map(payouts.map((p) => [p.provider.id, p.provider])).values()
  );

  const filtered = payouts.filter((p) => {
    if (statusFilter === "clawback") {
      if (p.payout.payoutType !== "clawback") return false;
    } else if (statusFilter !== "all" && p.payout.status !== statusFilter) {
      return false;
    }
    if (providerFilter !== "all" && p.provider.id !== providerFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAYOUTS_PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAYOUTS_PAGE_SIZE, page * PAYOUTS_PAGE_SIZE);
  const pendingPayouts = filtered.filter((p) => p.payout.status === "pending" && p.payout.payoutType !== "clawback");

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === pendingPayouts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingPayouts.map((p) => p.payout.id)));
    }
  }

  async function markPaid() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const res = await fetch("/api/admin/payouts/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutIds: ids }),
    });

    if (res.ok) {
      const { updated } = await res.json();
      setPayouts((prev) =>
        prev.map((p) =>
          ids.includes(p.payout.id)
            ? { ...p, payout: { ...p.payout, status: "paid" as const, paidAt: new Date().toISOString() } }
            : p
        )
      );
      setSelected(new Set());
      toast.success(`${updated} payout(s) marked as paid`);
    } else {
      toast.error("Failed to update payouts");
    }
  }

  function handleExport() {
    const rows = filtered.map((p) => ({
      "Payout ID": p.payout.id,
      "Provider": p.provider.name,
      "Booking Customer": p.booking.contactName,
      "Amount": formatPrice(p.payout.amount),
      "Type": p.payout.payoutType || "standard",
      "Status": p.payout.status,
      "Created": new Date(p.payout.createdAt).toLocaleDateString(),
      "Paid At": p.payout.paidAt ? new Date(p.payout.paidAt).toLocaleDateString() : "",
    }));
    exportToCSV(rows, `payouts-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // Calculate filtered totals
  const filteredPending = filtered
    .filter((p) => p.payout.status === "pending")
    .reduce((sum, p) => sum + p.payout.amount, 0);

  return (
    <div className="space-y-6">
      {/* Outstanding Clawback Warning */}
      {summary.clawbackCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Outstanding Clawbacks: {formatPrice(summary.totalClawback)}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {summary.clawbackCount} clawback{summary.clawbackCount !== 1 ? "s" : ""} pending settlement. These will be deducted from the next batch payout.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.totalPending)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.pendingCount} payout{summary.pendingCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.totalPaid)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.paidCount} payout{summary.paidCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="clawback">Clawback</SelectItem>
          </SelectContent>
        </Select>

        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-48">
            <Users className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <Button size="sm" onClick={markPaid}>
            Mark {selected.size} as Paid
          </Button>
        )}

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>

        <span className="text-sm text-muted-foreground">
          {filtered.length} payout{filtered.length !== 1 ? "s" : ""}
          {filteredPending > 0 && ` (${formatPrice(filteredPending)} pending)`}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                {pendingPayouts.length > 0 && (
                  <Checkbox
                    checked={selected.size === pendingPayouts.length && pendingPayouts.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                )}
              </TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Paid At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No payouts found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(({ payout, provider, booking }) => (
                <TableRow key={payout.id}>
                  <TableCell>
                    {payout.status === "pending" && payout.payoutType !== "clawback" && (
                      <Checkbox
                        checked={selected.has(payout.id)}
                        onCheckedChange={() => toggleSelect(payout.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell className="text-sm">{booking.contactName}</TableCell>
                  <TableCell className={`text-right font-medium ${payout.amount < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {payout.amount < 0 ? `-${formatPrice(Math.abs(payout.amount))}` : formatPrice(payout.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={payout.payoutType === "clawback" ? "destructive" : payout.status === "paid" ? "default" : "secondary"}>
                      {payout.payoutType === "clawback" ? "clawback" : payout.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(payout.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {payout.paidAt
                      ? new Date(payout.paidAt).toLocaleDateString()
                      : "—"}
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
