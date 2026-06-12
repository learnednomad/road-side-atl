"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

// One-tap loyalty redemption on a pending booking. 1 point = 1¢; applies
// min(balance, estimatedPrice) — the server enforces the same cap.
export function LoyaltyRedeemButton({
  bookingId,
  estimatedPrice,
  balance,
  onRedeemed,
}: {
  bookingId: string;
  estimatedPrice: number;
  balance: number;
  onRedeemed: (discountCents: number) => void;
}) {
  const [busy, setBusy] = useState(false);

  const applicable = Math.min(balance, estimatedPrice);
  if (applicable < 1) return null;

  const redeem = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, points: applicable }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Failed to apply points");
        return;
      }
      toast.success(`${formatPrice(data.discountCents)} discount applied.`);
      onRedeemed(data.discountCents);
    } catch {
      toast.error("Failed to apply points");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {`Apply ${applicable.toLocaleString("en-US")} pts (−${formatPrice(applicable)})`}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apply loyalty points?</AlertDialogTitle>
          <AlertDialogDescription>
            {`Redeem ${applicable.toLocaleString("en-US")} points for ${formatPrice(applicable)} off this booking. Redemptions can't be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={redeem}>Apply</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
