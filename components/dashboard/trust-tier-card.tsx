"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TrustTierInfo {
  trustTier: number;
  cleanTransactionCount: number;
  promotionThreshold: number;
  allowedPaymentMethods: string[];
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  cashapp: "CashApp",
  zelle: "Zelle",
  stripe: "Credit/Debit Card",
};

export function TrustTierCard() {
  const [tierInfo, setTierInfo] = useState<TrustTierInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users/me/trust-tier")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setTierInfo(data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trust Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-2 w-full rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tierInfo) return null;

  const isTier2 = tierInfo.trustTier >= 2;
  const safeThreshold = Math.max(1, tierInfo.promotionThreshold);
  const progressPercent = Math.min(
    100,
    (tierInfo.cleanTransactionCount / safeThreshold) * 100
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Trust Tier</CardTitle>
        <Badge variant={isTier2 ? "default" : "secondary"}>
          Tier {tierInfo.trustTier}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isTier2 ? (
          <p className="text-sm text-primary">
            Card Payments Unlocked
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress to card payments</span>
              <span className="font-medium">
                {tierInfo.cleanTransactionCount}/{tierInfo.promotionThreshold}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Complete {tierInfo.promotionThreshold - tierInfo.cleanTransactionCount} more
              {" "}clean transaction{tierInfo.promotionThreshold - tierInfo.cleanTransactionCount !== 1 ? "s" : ""} to
              unlock credit/debit card payments.
            </p>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Available Payment Methods</p>
          <div className="flex flex-wrap gap-1.5">
            {tierInfo.allowedPaymentMethods.map((method) => (
              <Badge key={method} variant="outline" className="text-xs">
                {METHOD_LABELS[method] ?? method}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
