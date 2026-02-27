"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { DollarSign } from "lucide-react";

export function BookingPriceOverride({
  bookingId,
  estimatedPrice,
  currentOverride,
  currentReason,
}: {
  bookingId: string;
  estimatedPrice: number;
  currentOverride: number | null;
  currentReason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const effectivePrice = currentOverride ?? estimatedPrice;

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && currentOverride !== null) {
      setAmount((currentOverride / 100).toFixed(2));
      setReason(currentReason ?? "");
    } else if (!isOpen) {
      setAmount("");
      setReason("");
    }
  }

  async function handleOverride() {
    const dollars = parseFloat(amount);
    if (isNaN(dollars) || dollars <= 0) {
      toast.error("Enter a valid positive dollar amount");
      return;
    }
    const cents = Math.round(dollars * 100);

    if (!reason.trim()) {
      toast.error("Override reason is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/override-price`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceOverrideCents: cents, reason: reason.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = "Failed to override price";
        try { message = JSON.parse(text).error || message; } catch { /* use default */ }
        throw new Error(message);
      }
      toast.success("Price override applied");
      setOpen(false);
      setAmount("");
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply override");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearOverride() {
    setClearing(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/override-price`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = "Failed to clear override";
        try { message = JSON.parse(text).error || message; } catch { /* use default */ }
        throw new Error(message);
      }
      toast.success("Price override cleared");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear override");
    } finally {
      setClearing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          Price Override
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estimated Price</span>
          <span className="text-sm">{formatPrice(estimatedPrice)}</span>
        </div>

        {currentOverride !== null && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Override Price</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Override</Badge>
                <span className="text-sm font-medium">{formatPrice(currentOverride)}</span>
              </div>
            </div>
            {currentReason && (
              <div className="rounded-md bg-muted p-2">
                <p className="text-xs text-muted-foreground">Reason: {currentReason}</p>
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm font-medium">Effective Price</span>
          <span className="text-sm font-bold">{formatPrice(effectivePrice)}</span>
        </div>

        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                {currentOverride !== null ? "Update Override" : "Override Price"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Override Booking Price</DialogTitle>
                <DialogDescription>
                  Set a custom price for this booking. This action is audit-logged.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Price (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current estimated: {formatPrice(estimatedPrice)}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason</label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Goodwill credit for delayed service, B2B contract rate"
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleOverride}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? "Applying..." : "Apply Override"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {currentOverride !== null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearOverride}
              disabled={clearing}
              className="text-destructive hover:text-destructive"
            >
              {clearing ? "Clearing..." : "Clear"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
