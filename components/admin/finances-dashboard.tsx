"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfitTrendChart, AgingChart } from "./financial-charts";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

interface FinancialSummary {
  totalRevenue: number;
  totalPayouts: number;
  platformProfit: number;
  profitMargin: number;
  outstandingPayments: number;
  outstandingCount: number;
  pendingPayouts: number;
  refundRate: number;
  avgRevenuePerJob: number;
  avgProfitPerJob: number;
}

interface TrendData {
  month: string;
  revenue: number;
  payouts: number;
  profit: number;
  profitMargin: number;
  jobCount: number;
}

interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

export function FinancesDashboard() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [aging, setAging] = useState<AgingBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, trendsRes, agingRes] = await Promise.all([
        fetch("/api/admin/finances/summary"),
        fetch("/api/admin/finances/trends?months=12"),
        fetch("/api/admin/finances/aging"),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (trendsRes.ok) {
        const data = await trendsRes.json();
        setTrends(data.trends || []);
      }
      if (agingRes.ok) {
        const data = await agingRes.json();
        setAging(data.buckets || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Financial Overview</h1>
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Financial Overview</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">
              Avg {formatPrice(summary.avgRevenuePerJob)}/job
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.platformProfit)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.profitMargin}% margin
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.outstandingPayments)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.outstandingCount} pending payment{summary.outstandingCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Refund Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.refundRate}%</p>
            <p className="text-xs text-muted-foreground">
              of all payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {trends.length > 0 && <ProfitTrendChart data={trends} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {aging.length > 0 && <AgingChart data={aging} />}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Payout Obligations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pending Payouts</span>
              <span className="text-lg font-semibold">{formatPrice(summary.pendingPayouts)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Payouts (All Time)</span>
              <span className="text-lg font-semibold">{formatPrice(summary.totalPayouts)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Profit/Job</span>
              <span className="text-lg font-semibold">{formatPrice(summary.avgProfitPerJob)}</span>
            </div>
            <Link
              href="/admin/payouts"
              className="block text-sm text-primary hover:underline mt-2"
            >
              View all payouts &rarr;
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
