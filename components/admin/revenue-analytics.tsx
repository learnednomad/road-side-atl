"use client";

import { useState, useEffect, useCallback } from "react";
import { subDays, endOfDay, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Target, AlertTriangle } from "lucide-react";
import { DateRangePicker, type DateRange } from "./date-range-picker";
import {
  DailyRevenueChart,
  ServiceRevenueChart,
  PaymentMethodChart,
} from "./revenue-charts";
import { ExportButton } from "./export-button";

interface AnalyticsData {
  dailySeries: Array<{ date: string; total: number; count: number }>;
  prevDailySeries: Array<{ date: string; total: number }>;
  byService: Array<{ serviceName: string; total: number; count: number }>;
  byMethod: Array<{ method: string; total: number; count: number }>;
  summary: {
    totalRevenue: number;
    transactionCount: number;
    avgBookingValue: number;
    completionRate: number;
    refundTotal: number;
    refundCount: number;
    revenueChange: number;
  };
  failedPayments: Array<{
    payment: {
      id: string;
      amount: number;
      method: string;
      status: string;
      createdAt: string;
    };
    booking: {
      id: string;
      contactName: string;
      contactEmail: string;
    };
  }>;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function RevenueAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/admin/revenue/analytics?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportParams = new URLSearchParams({
    startDate: dateRange.from.toISOString(),
    endDate: dateRange.to.toISOString(),
  }).toString();

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Revenue Analytics</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Revenue Analytics</h1>
        <div className="flex items-center gap-2">
          <ExportButton
            endpoint={`/api/admin/revenue/export?${exportParams}`}
            filename="revenue.csv"
          />
        </div>
      </div>

      <DateRangePicker value={dateRange} onChange={setDateRange} />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.totalRevenue)}</p>
            <p className={`text-xs ${summary.revenueChange >= 0 ? "text-green-600" : "text-red-600"}`}>
              {summary.revenueChange >= 0 ? "+" : ""}
              {summary.revenueChange}% vs prior period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Booking Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.avgBookingValue)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.transactionCount} transactions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.completionRate}%</p>
            <p className="text-xs text-muted-foreground">of all bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Refund Total</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.refundTotal)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.refundCount} refund{summary.refundCount !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <DailyRevenueChart
        data={data.dailySeries}
        prevData={data.prevDailySeries}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ServiceRevenueChart data={data.byService} />
        <PaymentMethodChart data={data.byMethod} />
      </div>

      {/* Failed/Refunded Payments */}
      {data.failedPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Failed & Refunded Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.failedPayments.map(({ payment, booking }) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{booking.contactName}</div>
                        <div className="text-xs text-muted-foreground">
                          {booking.contactEmail}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {payment.method}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            payment.status === "refunded" ? "secondary" : "destructive"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatPrice(payment.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
