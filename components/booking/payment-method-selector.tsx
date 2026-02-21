"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: string }> = {
  cash: { label: "Cash", icon: "💵" },
  cashapp: { label: "CashApp", icon: "📱" },
  zelle: { label: "Zelle", icon: "🏦" },
  stripe: { label: "Credit/Debit Card", icon: "💳" },
};

interface TrustTierInfo {
  trustTier: number;
  cleanTransactionCount: number;
  promotionThreshold: number;
  allowedPaymentMethods: string[];
}

export function PaymentMethodSelector({
  value,
  onChange,
  isAuthenticated,
}: {
  value: string | null;
  onChange: (method: string) => void;
  isAuthenticated: boolean;
}) {
  const [tierInfo, setTierInfo] = useState<TrustTierInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadTierInfo = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/users/me/trust-tier");
        const data = res.ok ? await res.json() : null;
        if (data) setTierInfo(data);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    loadTierInfo();
  }, [isAuthenticated]);

  const allowedMethods = tierInfo?.allowedPaymentMethods ?? ["cash", "cashapp", "zelle"];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Payment Method</p>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Payment Method</p>

      <div className="space-y-2">
        {allowedMethods.map((method) => {
          const info = PAYMENT_METHOD_LABELS[method];
          if (!info) return null;
          return (
            <button
              key={method}
              type="button"
              onClick={() => onChange(method)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                value === method
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted"
              )}
            >
              <span className="text-xl">{info.icon}</span>
              <span className="text-sm font-medium">{info.label}</span>
            </button>
          );
        })}
      </div>

      {isAuthenticated && tierInfo && tierInfo.trustTier === 1 && (
        <div className="rounded-lg bg-primary/10 p-3">
          <p className="text-xs font-medium text-primary">
            {tierInfo.cleanTransactionCount}/{tierInfo.promotionThreshold} clean transactions until card payments are unlocked
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, (tierInfo.cleanTransactionCount / Math.max(1, tierInfo.promotionThreshold)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {isAuthenticated && tierInfo && tierInfo.trustTier >= 2 && (
        <div className="rounded-lg bg-primary/10 p-2.5">
          <p className="text-xs font-medium text-primary">
            Card Payments Unlocked
          </p>
        </div>
      )}
    </div>
  );
}
