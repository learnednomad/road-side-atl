# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into RoadSide GA. The setup covers client-side initialization via `instrumentation-client.ts` (Next.js 15.3+ pattern), a server-side PostHog client at `lib/posthog-server.ts`, reverse-proxy rewrites in `next.config.ts` to avoid ad-blockers, environment variable configuration in `.env.local`, and `posthog-node` added to `serverExternalPackages`. User identification is wired on both the client (login, Google OAuth) and server (registration). Exception capture is enabled globally via `capture_exceptions: true`.

| Event name | Description | File |
|---|---|---|
| `booking_submitted` | Customer submits the multi-step booking form | `components/booking/booking-form.tsx` |
| `user_signed_up` | Customer completes account registration | `app/(auth)/register/page.tsx` |
| `user_logged_in` | Customer signs in (credentials or Google) | `app/(auth)/login/page.tsx` |
| `membership_checkout_started` | Customer initiates membership subscription checkout | `app/(marketing)/account/membership/membership-client.tsx` |
| `provider_registration_submitted` | Service provider submits registration | `app/(auth)/register/provider/page.tsx` |
| `booking_created` | Server confirms a new booking persisted | `server/api/routes/bookings.ts` |
| `booking_cancelled` | Customer cancels a pending/confirmed booking | `server/api/routes/bookings.ts` |
| `quote_approved` | Customer approves a provider price quote | `server/api/routes/bookings.ts` |
| `payment_checkout_session_created` | Stripe checkout session created for a booking | `server/api/routes/payments.ts` |
| `user_registered` | Server confirms new customer account created | `server/api/routes/auth.ts` |
| `membership_checkout_created` | Server creates Stripe subscription checkout session | `server/api/routes/memberships.ts` |
| `booking_confirmation_viewed` | Customer views booking confirmation page | `app/(marketing)/book/confirmation/page.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics (wizard)](https://us.posthog.com/project/483582/dashboard/1752948)
- **Booking conversion funnel**: [2BSnqlNx](https://us.posthog.com/project/483582/insights/2BSnqlNx) — Registration → Booking Submitted → Payment Checkout
- **New bookings over time**: [bM2wdHDx](https://us.posthog.com/project/483582/insights/bM2wdHDx)
- **User signups and logins**: [LHsxNI3J](https://us.posthog.com/project/483582/insights/LHsxNI3J)
- **Booking cancellations**: [ZIfWkdLO](https://us.posthog.com/project/483582/insights/ZIfWkdLO)
- **Membership checkout starts**: [4M9iUes6](https://us.posthog.com/project/483582/insights/4M9iUes6)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the current implementation identifies on fresh credential login but not on session restore. Consider calling `posthog.identify()` in the root layout or a session-aware component when an existing session is detected.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
