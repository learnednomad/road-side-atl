"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertCircle, Loader2, RefreshCw, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderReferralForm } from "@/components/provider/provider-referral-form";
import { formatPrice } from "@/lib/utils";

interface ReferralRecord {
  id: string;
  refereeId: string | null;
  refereeName: string | null;
  creditAmount: number;
  status: string;
  createdAt: string;
}

export default function ProviderReferralsPage() {
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const [listRes, balanceRes] = await Promise.all([
        fetch(`/api/referrals/provider?page=${page}&limit=20`),
        fetch("/api/referrals/me/balance"),
      ]);
      if (listRes.ok && balanceRes.ok) {
        const listData = await listRes.json();
        const balanceData = await balanceRes.json();
        setReferrals(listData.referrals || []);
        setTotalReferrals(listData.total || 0);
        setHasMore(listData.hasMore || false);
        setBalance(balanceData.balance || 0);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusColor = (status: string): "default" | "destructive" | "secondary" => {
    switch (status) {
      case "credited": return "default";
      case "expired": return "destructive";
      default: return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">Failed to load referral data.</p>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Referrals</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(balance)}</div>
          </CardContent>
        </Card>
      </div>

      <ProviderReferralForm onSuccess={fetchData} />

      {referrals.length > 0 && (
        <>
          <h2 className="text-xl font-semibold">Referral History</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Referred Provider</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell className="text-sm">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {referral.refereeName || "Pending signup"}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatPrice(referral.creditAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor(referral.status)}>
                        {referral.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {hasMore && (
            <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
              Load More
            </Button>
          )}
        </>
      )}
    </div>
  );
}
