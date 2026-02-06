"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, Search, RefreshCw } from "lucide-react";
import { exportToCSV } from "@/lib/csv";

interface AuditLog {
  id: number;
  action: string;
  user_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "booking.create", label: "Booking Created" },
  { value: "booking.update", label: "Booking Updated" },
  { value: "booking.status_change", label: "Status Change" },
  { value: "booking.assign_provider", label: "Provider Assigned" },
  { value: "booking.cancel", label: "Booking Cancelled" },
  { value: "provider.create", label: "Provider Created" },
  { value: "provider.update", label: "Provider Updated" },
  { value: "payout.mark_paid", label: "Payout Marked Paid" },
  { value: "payment.confirm", label: "Payment Confirmed" },
  { value: "user.register", label: "User Registered" },
  { value: "user.login", label: "User Login" },
];

const RESOURCE_TYPES = [
  { value: "all", label: "All Resources" },
  { value: "booking", label: "Bookings" },
  { value: "provider", label: "Providers" },
  { value: "payment", label: "Payments" },
  { value: "user", label: "Users" },
  { value: "payout", label: "Payouts" },
];

function getActionBadgeColor(action: string): string {
  if (action.includes("create") || action.includes("register")) return "bg-green-100 text-green-800";
  if (action.includes("update") || action.includes("change")) return "bg-blue-100 text-blue-800";
  if (action.includes("delete") || action.includes("cancel")) return "bg-red-100 text-red-800";
  if (action.includes("confirm") || action.includes("paid")) return "bg-purple-100 text-purple-800";
  if (action.includes("assign")) return "bg-orange-100 text-orange-800";
  return "bg-gray-100 text-gray-800";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function AuditLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [searchUserId, setSearchUserId] = useState("");
  const [page, setPage] = useState(1);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (resourceFilter !== "all") params.set("resourceType", resourceFilter);
      if (searchUserId) params.set("userId", searchUserId);
      params.set("page", page.toString());
      params.set("limit", "50");

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
      }
    } catch {
      console.error("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, resourceFilter, page]);

  function handleSearch() {
    setPage(1);
    fetchLogs();
  }

  function handleExport() {
    const rows = logs.map((log) => ({
      "Timestamp": formatDate(log.created_at),
      "Action": log.action,
      "User ID": log.user_id || "-",
      "Resource Type": log.resource_type || "-",
      "Resource ID": log.resource_id || "-",
      "Details": JSON.stringify(log.details),
      "IP Address": log.ip_address || "-",
    }));
    exportToCSV(rows, `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Resource Type" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                placeholder="User ID..."
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                className="w-48"
              />
              <Button size="sm" variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1" />

            <Button size="sm" variant="outline" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="w-28">IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No audit logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge className={getActionBadgeColor(log.action)}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.resource_type && (
                      <div className="text-sm">
                        <span className="font-medium">{log.resource_type}</span>
                        {log.resource_id && (
                          <span className="text-muted-foreground ml-1">
                            #{log.resource_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground max-w-xs truncate">
                      {Object.entries(log.details || {}).map(([key, value]) => (
                        <span key={key} className="mr-2">
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {log.ip_address || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {logs.length} entries
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-2">Page {page}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={logs.length < 50}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
