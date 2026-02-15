"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  Clock,
  Wallet,
  TrendingUp,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { MonthlyEarningsChart, ServiceBreakdownChart } from "./earnings-charts";
import { formatPrice } from "@/lib/utils";

interface EarningsSummaryData {
  totalEarned: number;
  pendingPayout: number;
  paidOut: number;
  thisMonthEarnings: number;
  completedJobsThisMonth: number;
  commissionRate: number;
  commissionType: string;
  flatFeeAmount: number | null;
}

interface PayoutHistoryItem {
  payout: {
    id: string;
    amount: number;
    status: "pending" | "paid";
    createdAt: string;
    paidAt: string | null;
  };
  booking: {
    id: string;
    contactName: string;
    createdAt: string;
  };
  service: { name: string };
}

interface TrendItem {
  month: string;
  earnings: number;
  jobCount: number;
}

interface ServiceBreakdown {
  serviceName: string;
  earnings: number;
  jobCount: number;
}

export function EarningsSummary() {
  const [summary, setSummary] = useState<EarningsSummaryData | null>(null);
  const [history, setHistory] = useState<PayoutHistoryItem[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [breakdown, setBreakdown] = useState<ServiceBreakdown[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, trendsRes, breakdownRes] = await Promise.all([
        fetch("/api/provider/earnings/summary"),
        fetch("/api/provider/earnings/trends"),
        fetch("/api/provider/earnings/by-service"),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (trendsRes.ok) {
        const data = await trendsRes.json();
        setTrends(data.trends || []);
      }
      if (breakdownRes.ok) {
        const data = await breakdownRes.json();
        setBreakdown(data.breakdown || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", historyPage.toString());
    params.set("limit", "10");
    if (historyFilter !== "all") params.set("status", historyFilter);

    const res = await fetch(`/api/provider/earnings/history?${params}`);
    if (res.ok) {
      const data = await res.json();
      setHistory(data.data || []);
      setHistoryTotalPages(data.totalPages || 1);
    }
  }, [historyPage, historyFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Earnings</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-1" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const commissionDisplay =
    summary.commissionType === "flat_per_job"
      ? `${formatPrice(summary.flatFeeAmount || 0)} per job`
      : `${(summary.commissionRate / 100).toFixed(0)}% of job revenue`;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Earnings</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.totalEarned)}</p>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payout</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.pendingPayout)}</p>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.paidOut)}</p>
            <p className="text-xs text-muted-foreground">Received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.thisMonthEarnings)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.completedJobsThisMonth} job{summary.completedJobsThisMonth !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Commission Info */}
      <Card>
        <CardContent className="flex items-center gap-3 py-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Your commission rate: <span className="font-medium text-foreground">{commissionDisplay}</span>
          </p>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {trends.length > 0 && <MonthlyEarningsChart data={trends} />}
        <ServiceBreakdownChart data={breakdown} />
      </div>

      {/* Payout History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Payout History</h2>
          <Select value={historyFilter} onValueChange={(v) => { setHistoryFilter(v); setHistoryPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No payouts yet.
                  </TableCell>
                </TableRow>
              ) : (
                history.map(({ payout, booking, service }) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-sm">
                      {new Date(payout.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">{service.name}</TableCell>
                    <TableCell className="text-sm">{booking.contactName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(payout.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={payout.status === "paid" ? "default" : "secondary"}>
                        {payout.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {historyTotalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {historyPage} of {historyTotalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryPage((p) => p - 1)}
                disabled={historyPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryPage((p) => p + 1)}
                disabled={historyPage >= historyTotalPages}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
