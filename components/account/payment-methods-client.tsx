"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type PaymentMethod = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

/** Card-collection form, rendered inside <Elements> once a SetupIntent exists. */
function AddCardForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    setSubmitting(false);
    if (confirmError) {
      setError(confirmError.message ?? "Could not save card.");
      return;
    }
    onDone();
  };

  return (
    <div className="rounded-lg border p-4">
      <PaymentElement />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button onClick={handleSubmit} disabled={!stripe || submitting}>
          {submitting ? "Saving…" : "Save card"}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PaymentMethodsClient() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payment-methods");
      if (!res.ok) throw new Error("Failed to load payment methods.");
      const data = await res.json();
      setMethods(data.methods ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startAdd = async () => {
    setError(null);
    try {
      const res = await fetch("/api/payment-methods/setup-intent", { method: "POST" });
      if (!res.ok) throw new Error("Could not start card setup.");
      const data = await res.json();
      setClientSecret(data.clientSecret);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start card setup.");
    }
  };

  const finishAdd = () => {
    setClientSecret(null);
    load();
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/payment-methods/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove card.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove card.");
    } finally {
      setBusyId(null);
    }
  };

  const makeDefault = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/payment-methods/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methodId: id }),
      });
      if (!res.ok) throw new Error("Could not set default.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set default.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {methods.length === 0 && !clientSecret && (
        <p className="text-sm text-muted-foreground">No saved cards yet.</p>
      )}

      <ul className="space-y-2">
        {methods.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium capitalize">{m.brand ?? "Card"}</span>
              <span className="text-muted-foreground">•••• {m.last4}</span>
              <span className="text-sm text-muted-foreground">
                {m.expMonth}/{m.expYear}
              </span>
              {m.isDefault && <Badge variant="secondary">Default</Badge>}
            </div>
            <div className="flex gap-2">
              {!m.isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeDefault(m.id)}
                  disabled={busyId === m.id}
                >
                  Make default
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(m.id)}
                disabled={busyId === m.id}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {clientSecret && stripePromise ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <AddCardForm onDone={finishAdd} />
        </Elements>
      ) : (
        <Button onClick={startAdd}>+ Add card</Button>
      )}
    </div>
  );
}
