# Notifications (Novu)

RoadSide GA uses a self-hosted [Novu](https://novu.co) instance as its notification
hub and **in-app notification center (Inbox)**.

- Dashboard: https://novu.roadsidega.com
- API: https://novu-api.roadsidega.com
- WebSocket: https://novu-ws.roadsidega.com

## Architecture

```
transition (booking/payment/provider/payout/review/loyalty/referral/membership)
        │
        ├─ lib/notifications/index.ts  →  Resend (email) · Twilio (SMS) · web-push   [legacy, unchanged]
        │
        └─ lib/notifications/novu.ts   →  triggerNovu(workflowId, to, payload)        [Novu]
                                              └─ workflow (scripts/seed-novu-workflows.mjs)
                                                    └─ in-app Inbox  (+ email/SMS/push, staged)
```

`lib/notifications/novu.ts` is the only integration point. It is:

- **Fire-and-forget & non-throwing** — a notification failure can never break a booking/payment flow.
- **Gated by `NOVU_ENABLED`** — when off (default) every function is a no-op. Safe to ship dark and flip per environment.
- **REST-based** — triggers hit `POST /v1/events/trigger` directly (no SDK), so there's no SDK/server version drift against the 3.17 self-hosted instance.

### Phased rollout (no double-send)

The app already sends email/SMS/push through `lib/notifications` (Resend/Twilio/web-push).
Novu's value today is the **in-app Inbox**, which the app lacked.

- **Phase 1 (this integration):** only the `in_app` channel is active in every workflow.
  Novu runs alongside the legacy senders → users get a new Inbox with **zero double-send**.
- **Phase 2 (cutover):** Novu delivers email/SMS/push too. Two coordinated switches:
  1. **Novu side** — configure the Resend + Twilio integrations (done on Dev) and
     activate the email/SMS workflow steps: `CHANNELS_ACTIVE=true … node scripts/seed-novu-workflows.mjs`.
  2. **App side** — set `NOVU_OWNS_DELIVERY=true`. The `novuOwnsDelivery()` gate then
     makes the legacy senders **skip** the events Novu covers (booking lifecycle,
     payments, payouts, provider lifecycle, reviews, loyalty, referrals, memberships,
     dispatch) so there is no double-send. Events WITHOUT a Novu workflow (email
     verification, password reset, B2B invoices, Checkr, onboarding-step emails,
     migration notices, Stripe-Connect reminders, admin manual payment receipts) are
     never gated and keep using the legacy senders.

  Both switches must flip together per environment (flag on but channels inactive →
  silent gap; channels active but flag off → double-send). Flip dev, verify a real
  event delivers exactly once, then prod.

## Workflows

All workflow definitions live in [`scripts/seed-novu-workflows.mjs`](../scripts/seed-novu-workflows.mjs)
(35 workflows — booking lifecycle, payments, payouts, provider onboarding, reviews,
loyalty, referrals, memberships, dispatch, and `ops-*` admin alerts). That script is the
source of truth; the Novu dashboard mirrors it.

### Seeding / updating

Novu only allows authoring in the **Development** environment; changes are then promoted
to Production. The script is idempotent (create-or-update + activate, matched by name).

```bash
# 1. author in Development and promote to Production in one go
NOVU_API_URL=https://novu-api.roadsidega.com \
NOVU_ENV_API_KEY=<DEVELOPMENT api key> \
PROMOTE_TO_PROD=true \
node scripts/seed-novu-workflows.mjs

# Phase 2: also activate email/SMS/push channels
CHANNELS_ACTIVE=true NOVU_ENV_API_KEY=<DEV key> PROMOTE_TO_PROD=true node scripts/seed-novu-workflows.mjs
```

## Subscribers

`subscriberId` convention:

- **Customer** → `users.id` (`custSub(userId)`)
- **Provider** → `provider:<providerId>` (`provSub(providerId)`)
- **Ops/admin broadcast** → Novu Topic `admins` / `admins:<tenantId>` (`adminsTopic`)

Subscribers are upserted (`syncSubscriber`) at customer signup and provider registration;
Novu also auto-creates a subscriber on first trigger, so the Inbox works even before an
explicit sync (email/SMS in phase 2 need the synced email/phone).

Multi-tenant: pass `tenant: tenantId` on triggers to isolate branding/preferences.

## In-app Inbox (front end)

- `components/notifications/inbox-bell.tsx` — drop `<InboxBell/>` into any authenticated
  layout. It renders nothing unless Novu is enabled and the user is signed in.
- `GET /api/novu/inbox-config` (auth required) returns the subscriberId for the user's role
  plus an **HMAC `subscriberHash`** minted server-side, so a user can only read their own feed.
- Requires the `@novu/react` package and `NEXT_PUBLIC_NOVU_*` env vars.

## Environment variables

See `.env.example` (Novu block). Server: `NOVU_ENABLED`, `NOVU_SECRET_KEY` (per-env API key),
`NOVU_API_URL`. Client: `NEXT_PUBLIC_NOVU_APP_ID` (environment applicationIdentifier),
`NEXT_PUBLIC_NOVU_BACKEND_URL`, `NEXT_PUBLIC_NOVU_SOCKET_URL`.

## Idempotency

Every trigger passes a stable `transactionId` (e.g. `${bookingId}:dispatched`,
`${disputeId}:disputed`) so Stripe-webhook retries and double-fires don't duplicate Inbox items.
