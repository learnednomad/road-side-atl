"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";

interface ReferralCreditSelectorProps {
  bookingPrice: number; // cents
  onCreditChange: (amount: number) => void;
}

export function ReferralCreditSelector({ bookingPrice, onCreditChange }: ReferralCreditSelectorProps) {
  const [balance, setBalance] = useState(0);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals/me/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.balance) setBalance(data.balance);
      })
      .catch(() => {});
  }, []);

  if (balance <= 0) return null;

  const creditToApply = Math.min(balance, bookingPrice);

  const handleToggle = (checked: boolean) => {
    setApplied(checked);
    onCreditChange(checked ? creditToApply : 0);
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <Label htmlFor="credit-toggle" className="text-sm font-medium">
            Apply Referral Credit
          </Label>
          <p className="text-xs text-muted-foreground">
            Available: {formatPrice(balance)} — Applying: {formatPrice(applied ? creditToApply : 0)}
          </p>
        </div>
        <Switch id="credit-toggle" checked={applied} onCheckedChange={handleToggle} />
      </CardContent>
    </Card>
  );
}
