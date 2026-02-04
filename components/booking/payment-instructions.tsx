"use client";

import { DollarSign, Smartphone, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BUSINESS } from "@/lib/constants";

interface PaymentInstructionsProps {
  isDiagnostics: boolean;
  estimatedPrice: number;
  bookingId: string;
  paid?: boolean;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PaymentInstructions({
  isDiagnostics,
  estimatedPrice,
  bookingId,
  paid,
}: PaymentInstructionsProps) {
  if (paid) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6 text-center">
          <Badge className="mb-2 bg-green-600">Payment Received</Badge>
          <p className="text-sm text-muted-foreground">
            Your card payment has been processed. We&apos;ll confirm your booking shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function handleStripeCheckout() {
    try {
      const res = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Stripe might not be configured
    }
  }

  return (
    <div className="space-y-4">
      {/* Primary payment methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {isDiagnostics ? "Payment Required to Confirm" : "Payment After Service"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDiagnostics && (
            <p className="text-sm font-medium text-destructive">
              Send {formatPrice(estimatedPrice)} via CashApp or Zelle to confirm your appointment.
              Your booking will not be scheduled until payment is received.
            </p>
          )}
          {!isDiagnostics && (
            <p className="text-sm text-muted-foreground">
              Pay after your service is completed via Cash, CashApp, or Zelle.
            </p>
          )}

          <div className="rounded-lg bg-muted p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">CashApp</span>
              <code className="rounded bg-background px-2 py-1 text-sm font-bold">
                {BUSINESS.cashAppTag}
              </code>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-medium">Zelle</span>
              <code className="rounded bg-background px-2 py-1 text-sm font-bold">
                {BUSINESS.zelleInfo}
              </code>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-medium">Cash</span>
              <span className="text-sm text-muted-foreground">
                Pay technician on arrival
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Amount due: <strong>{formatPrice(estimatedPrice)}</strong>
          </p>
        </CardContent>
      </Card>

      {/* Stripe fallback */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Prefer to pay by card?</p>
              <p className="text-xs text-muted-foreground">
                Credit/debit card via secure checkout
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleStripeCheckout}>
              <CreditCard className="mr-2 h-4 w-4" />
              Pay with Card
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
