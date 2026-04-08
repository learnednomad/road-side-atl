---
title: "Product Brief Distillate: Mobile Mechanics + Beta"
type: llm-distillate
source: "product-brief-mobile-mechanics-beta.md"
created: "2026-04-07"
purpose: "Token-efficient context for downstream PRD creation"
---

# Distillate: Mobile Mechanics as a Service + Open Beta

## Scope Decisions

- **In-scope (beta):** 6 mechanic services (oil change, brakes, battery, maintenance, AC, belts), scheduling-only enforcement, beta mode via platform_settings, trust tier bypass, beta user tracking, full mobile parity, Expo push notifications, mechanic pre-dispatch cron
- **Out-scope (post-beta):** subscription tiers, parts ordering/inventory, in-app chat, multi-city, mechanic cert verification, vehicle maintenance history, warranty programs
- **Parts model decision:** providers supply own parts during beta — platform stays out of inventory. Price override mechanism handles premium parts upgrades. Revisit post-beta when volume data informs margin decisions

## Technical Context

- Service category enum: `db/schema/services.ts:12-15` — add `"mechanics"` value, requires `ALTER TYPE` migration
- New column needed: `schedulingMode` on services table — `"immediate"` | `"scheduled"` | `"both"`, default `"both"`
- Provider specialty matching: existing `specialties` JSONB array + auto-dispatch already supports category matching — add `"mechanics"` to relevant providers' arrays, no schema change for dispatch
- Beta config: 3 rows in `platform_settings` table (`beta_mode_active`, `beta_start_date`, `beta_end_date`), helper in `server/api/lib/beta.ts`
- Trust tier bypass: single check in `server/api/lib/trust-tier.ts:9` `getAllowedPaymentMethods()` — if beta active, return tier 2 methods for all
- Mechanic dispatch is cron-based (not auto on confirm) because all mechanic bookings are scheduled — fire 2 hours before `scheduledAt` via `server/cron.ts`
- Push notifications: web uses VAPID (`server/api/routes/push.ts`), mobile needs Expo push token registration — extend `push_subscriptions` or new `device_tokens` table
- Mobile repo: `~/WebstormProjects/roadside-atl-mobile` — Expo SDK 54, React Native 0.81.5, TypeScript, NativeWind, React Query

## Requirements Hints

- Mechanic bookings MUST have `scheduledAt` — return 400 if missing for `mechanics` category
- Beta user auto-enrollment on any booking during beta period, not just mechanic
- Observation → mechanic upsell: existing observation follow-up SMS/email should include deep link to book mechanic service when observation category matches a mechanic service (e.g., "Brakes" observation → brake pad service link)
- B2B fleet maintenance: use existing `perJobRateCents` contract override for bulk pricing, existing monthly invoice generation handles billing
- Provider recruitment: need 5-10 mechanic-capable providers before beta customer bookings go live — three pools: existing certified providers, independent Craigslist/FB mechanics, shop mechanics seeking side work
- All mechanic service prices include standard parts — provider net after parts and commission should be $20-80/job depending on service

## Pricing (Cents)

| Service | Base Price | Commission (25%) | Provider Keeps | Est. Parts Cost | Provider Net |
|---------|-----------|------------------|----------------|-----------------|-------------|
| Oil Change | 7500 | 1875 | 5625 | 2500-3500 | 2125-3125 |
| Brake Pads | 15000 | 3750 | 11250 | 3000-5000 | 6250-8250 |
| Battery | 12000 | 3000 | 9000 | 4000-6000 | 3000-5000 |
| Maintenance | 9500 | 2375 | 7125 | 500-1500 | 5625-6625 |
| AC Repair | 13000 | 3250 | 9750 | 2000-3000 | 6750-7750 |
| Belt Replace | 11000 | 2750 | 8250 | 1500-3000 | 5250-6750 |

## Mobile App Gaps (Priority Order)

1. Push notifications — no `expo-notifications` setup, no device token registration
2. Real-time tracking map — no `react-native-maps` component, no WebSocket consumer
3. Observations — no provider observation form or API hooks
4. Inspection reports — no provider inspection form
5. Referrals — no referral feature directory, no share integration
6. Reviews — partially exists (`src/app/review.tsx`), needs verification
7. Service category filtering — current services screen is flat list, needs tabs/grouping
8. Mechanic booking date picker — needs scheduled-only enforcement in booking flow

## Rejected Ideas

- Feature flag system for beta — over-engineered, `platform_settings` toggle is sufficient
- Invite codes / waitlist — contradicts "no gating" requirement
- Subscription fees during beta — testing workflow, not revenue model
- Platform-managed parts inventory — too complex for beta, provider-supplied model is simpler
- Separate "mechanic" provider type enum — `specialties` JSONB array already handles this
- Separate mobile mechanic app — one platform, one codebase, category expansion

## Open Questions

- What checklist configs should mechanic services have? (e.g., oil change checklist: drain oil, replace filter, refill, check levels, inspect belt)
- Should mechanic providers have minimum tool/equipment requirements documented in onboarding?
- What's the geographic radius for mechanic services? Same 50-mile dispatch radius as roadside, or tighter for scheduled work?
- Should beta users get any incentive (credits, discounts) for feedback/reviews?
- Post-beta pricing: will mechanic prices increase, or are beta prices the floor?

## Success Metrics (Beta)

- 50+ mechanic bookings during 2-month beta
- 200+ beta user sign-ups
- >70% mobile booking completion rate
- >80% provider mechanic job acceptance rate
- >60% push notification opt-in rate
- NPS >40 from beta users
