"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import posthog from "posthog-js";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
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

interface QuoteLineItem {
  description: string;
  amountCents: number;
}

interface BookingQuote {
  id: string;
  lineItems: QuoteLineItem[];
  totalCents: number;
  status: "sent" | "approved" | "declined";
  notes?: string | null;
}

// After an on-site inspection the provider sends an itemized quote; the
// customer approves (locks booking.finalPrice) or declines (provider may
// re-quote). Self-contained: renders nothing unless a quote awaits action.
// Only the booking owner can fetch the quote, so this stays hidden for
// guests viewing the public tracking page.
export function QuoteApprovalCard({
  bookingId,
  onApproved,
}: {
  bookingId: string;
  onApproved?: (totalCents: number) => void;
}) {
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [acting, setActing] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/quote`);
      if (!res.ok) {
        setQuote(null);
        return;
      }
      setQuote(await res.json());
    } catch {
      setQuote(null);
    }
  }, [bookingId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const act = async (action: "approve" | "decline") => {
    setActing(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/quote/${action}`, {
        method: "POST",
      });
      if (res.status === 409) {
        // Actioned concurrently (e.g. from the mobile app) — just refresh.
        toast.info("This quote was already handled. Refreshing…");
        await refetch();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || `Failed to ${action} quote`);
        return;
      }
      posthog.capture(ANALYTICS_EVENTS.QUOTE_APPROVAL_SUBMITTED, {
        booking_id: bookingId,
        decision: action === "approve" ? "approved" : "rejected",
        total_cents: quote?.totalCents,
      });
      if (action === "approve" && quote) {
        toast.success(`Quote approved — ${formatPrice(quote.totalCents)} locked in.`);
        onApproved?.(quote.totalCents);
      } else {
        toast.success("Quote declined. Your provider can send a revised quote.");
      }
      setQuote(null);
    } catch {
      toast.error(`Failed to ${action} quote`);
    } finally {
      setActing(false);
    }
  };

  if (!quote || quote.status !== "sent") return null;

  return (
    <div className="mb-6 rounded-2xl border-2 border-red-600 bg-white p-6">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-red-600">
        Quote — your approval needed
      </p>
      <div className="mt-4">
        {quote.lineItems.map((item) => (
          <div
            key={`${item.description}-${item.amountCents}`}
            className="flex items-baseline justify-between gap-4 py-1.5"
          >
            <p className="text-sm text-neutral-700">{item.description}</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-neutral-950">
              {formatPrice(item.amountCents)}
            </p>
          </div>
        ))}
        <div className="mt-2 flex items-baseline justify-between border-t border-neutral-200 pt-3">
          <p className="font-semibold text-neutral-950">Total</p>
          <p className="font-mono text-xl font-bold text-neutral-950">
            {formatPrice(quote.totalCents)}
          </p>
        </div>
        {quote.notes ? (
          <p className="mt-3 text-xs text-neutral-500">{quote.notes}</p>
        ) : null}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={acting}
              className="rounded-full bg-neutral-950 px-6 font-mono text-xs uppercase tracking-wider hover:bg-neutral-800"
            >
              Approve Quote
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve this quote?</AlertDialogTitle>
              <AlertDialogDescription>
                {`This locks in ${formatPrice(quote.totalCents)} as your final price. Work proceeds once approved.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => act("approve")}>Approve</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              disabled={acting}
              className="rounded-full px-6 font-mono text-xs uppercase tracking-wider"
            >
              Decline
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Decline this quote?</AlertDialogTitle>
              <AlertDialogDescription>
                Your provider will be notified and can send a revised quote.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => act("decline")}>Decline</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
