import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
      // apiVersion is pinned by the SDK to the version it was built for.
      // Avoid overriding unless you've tested against a specific version.
    });
  }
  return _stripe;
}

// For backward compatibility
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as Stripe)[prop as keyof Stripe];
  },
});
