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

// Friendly display names for all audit actions
const ACTION_LABELS: Record<string, string> = {
  "booking.create": "Booking Created",
  "booking.update": "Booking Updated",
  "booking.status_change": "Booking Status Changed",
  "booking.assign_provider": "Provider Assigned",
  "booking.cancel": "Booking Cancelled",
  "booking.price_override": "Price Override",
  "booking.delay_notification": "Delay Notification Sent",
  "booking.update_notes": "Booking Notes Updated",
  "provider.create": "Provider Created",
  "provider.update": "Provider Updated",
  "provider.delete": "Provider Removed",
  "provider.status_change": "Provider Status Changed",
  "provider.invite": "Provider Invited",
  "provider.invite_accepted": "Invite Accepted",
  "provider.self_register": "Provider Signed Up",
  "provider.view_tax_id": "Tax ID Viewed",
  "provider.update_tax_id": "Tax ID Updated",
  "provider.1099_export": "1099 Data Exported",
  "payout.create": "Payout Created",
  "payout.mark_paid": "Payout Marked Paid",
  "payout.clawback": "Payout Clawed Back",
  "payout.batch_paid": "Batch Payout Processed",
  "payment.confirm": "Payment Confirmed",
  "payment.refund": "Payment Refunded",
  "payment.dispute": "Payment Disputed",
  "payment.receipt_sent": "Receipt Sent",
  "user.login": "User Signed In",
  "user.logout": "User Signed Out",
  "user.register": "User Registered",
  "user.mobile_login": "Mobile Sign In",
  "settings.update": "Settings Updated",
  "auto_dispatch.attempt": "Auto-Dispatch Attempted",
  "auto_dispatch.success": "Auto-Dispatch Succeeded",
  "auto_dispatch.failure": "Auto-Dispatch Failed",
  "invoice.generate": "Invoice Generated",
  "invoice.create_standalone": "Invoice Created",
  "invoice.issue": "Invoice Issued",
  "invoice.void": "Invoice Voided",
  "invoice.send": "Invoice Sent",
  "invoice.mark_paid": "Invoice Paid",
  "invoice.mark_overdue": "Invoice Overdue",
  "trust_tier.promote": "Trust Tier Promoted",
  "trust_tier.demote": "Trust Tier Demoted",
  "trust_tier.admin_override": "Trust Tier Override",
  "trust_tier.bypass_attempt": "Trust Tier Bypass Attempt",
  "observation.submit": "Observation Submitted",
  "observation.follow_up_sent": "Follow-Up Sent",
  "referral.create": "Referral Created",
  "referral.credit": "Referral Credit Applied",
  "referral.expire": "Referral Expired",
  "inspection.generate": "Inspection Report Generated",
  "inspection.email_sent": "Inspection Report Emailed",
  "pricing.update_block": "Pricing Block Updated",
  "pricing.toggle_storm_mode": "Storm Mode Toggled",
  "commission.update_rate": "Commission Rate Updated",
  "service.update_checklist_config": "Checklist Config Updated",
  "b2b_account.create": "B2B Account Created",
  "b2b_account.update": "B2B Account Updated",
  "b2b_account.update_contract": "B2B Contract Updated",
  "b2b_account.status_change": "B2B Account Status Changed",
  "b2b_account.create_booking": "B2B Booking Created",
  "b2b_account.generate_invoice": "B2B Invoice Generated",
  "onboarding.fcra_consent": "FCRA Consent Given",
  "onboarding.step_started": "Onboarding Step Started",
  "onboarding.step_completed": "Onboarding Step Completed",
  "onboarding.step_rejected": "Onboarding Step Rejected",
  "onboarding.activated": "Provider Activated",
  "onboarding.suspended": "Provider Suspended",
  "onboarding.rejected": "Provider Rejected",
  "onboarding.migration_bypass": "Onboarding Bypassed",
  "onboarding.status_changed": "Onboarding Status Changed",
  "onboarding.invite_sent": "Onboarding Invite Sent",
};

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "booking", label: "Bookings" },
  { value: "provider", label: "Providers" },
  { value: "payout", label: "Payouts" },
  { value: "payment", label: "Payments" },
  { value: "user", label: "Users" },
  { value: "invoice", label: "Invoices" },
  { value: "onboarding", label: "Onboarding" },
  { value: "auto_dispatch", label: "Auto-Dispatch" },
  { value: "trust_tier", label: "Trust Tier" },
  { value: "b2b_account", label: "B2B Accounts" },
  { value: "settings", label: "Settings" },
];

const RESOURCE_TYPES = [
  { value: "all", label: "All Resources" },
  { value: "booking", label: "Bookings" },
  { value: "provider", label: "Providers" },
  { value: "payment", label: "Payments" },
  { value: "user", label: "Users" },
  { value: "payout", label: "Payouts" },
  { value: "invoice", label: "Invoices" },
  { value: "onboarding_step", label: "Onboarding Steps" },
  { value: "provider_invite", label: "Provider Invites" },
];

function getActionBadgeColor(action: string): string {
  if (action.includes("create") || action.includes("register") || action.includes("activated") || action.includes("self_register")) return "bg-green-100 text-green-800";
  if (action.includes("update") || action.includes("change") || action.includes("toggle")) return "bg-blue-100 text-blue-800";
  if (action.includes("delete") || action.includes("cancel") || action.includes("void") || action.includes("reject") || action.includes("suspend") || action.includes("clawback")) return "bg-red-100 text-red-800";
  if (action.includes("confirm") || action.includes("paid") || action.includes("complete")) return "bg-purple-100 text-purple-800";
  if (action.includes("assign") || action.includes("dispatch")) return "bg-orange-100 text-orange-800";
  if (action.includes("invite") || action.includes("sent") || action.includes("email")) return "bg-cyan-100 text-cyan-800";
  if (action.includes("login") || action.includes("logout") || action.includes("consent")) return "bg-gray-100 text-gray-800";
  return "bg-gray-100 text-gray-800";
}

const RESOURCE_LABELS: Record<string, string> = {
  booking: "Booking",
  provider: "Provider",
  payment: "Payment",
  user: "User",
  payout: "Payout",
  invoice: "Invoice",
  onboarding_step: "Onboarding Step",
  provider_invite: "Provider Invite",
  service: "Service",
  trust_tier: "Trust Tier",
  b2b_account: "B2B Account",
  settings: "Settings",
};

const DETAIL_LABELS: Record<string, string> = {
  email: "Email",
  platform: "Platform",
  method: "Method",
  status: "Status",
  newStatus: "New Status",
  oldStatus: "Previous Status",
  providerId: "Provider",
  bookingId: "Booking",
  serviceName: "Service",
  stepType: "Step",
  name: "Name",
  reason: "Reason",
  amount: "Amount",
  ipAddress: "IP",
  timestamp: "Time",
  stormMode: "Storm Mode",
  rate: "Rate",
  inviteToken: "Invite",
};

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

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("actionPrefix", actionFilter);
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
  }, [actionFilter, resourceFilter, searchUserId, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
                      {getActionLabel(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.resource_type && (
                      <div className="text-sm">
                        <span className="font-medium">{RESOURCE_LABELS[log.resource_type] || log.resource_type}</span>
                        {log.resource_id && (
                          <span className="text-muted-foreground ml-1">
                            #{log.resource_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground max-w-xs space-x-2">
                      {Object.entries(log.details || {}).map(([key, value]) => {
                        const label = DETAIL_LABELS[key] || key;
                        let displayValue = String(value);
                        // Truncate long values like tokens
                        if (displayValue.length > 30) displayValue = displayValue.slice(0, 27) + "...";
                        return (
                          <span key={key}>
                            <span className="font-medium text-foreground/70">{label}:</span> {displayValue}
                          </span>
                        );
                      })}
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
