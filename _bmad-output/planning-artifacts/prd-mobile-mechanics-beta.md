---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-mobile-mechanics-beta.md
  - _bmad-output/planning-artifacts/product-brief-mobile-mechanics-beta-distillate.md
  - _bmad-output/planning-artifacts/prd.md
  - docs/feature-catalog-technical.md
  - docs/project-overview.md
workflowType: 'prd'
extends: 'prd.md'
documentCounts:
  briefs: 1
  distillates: 1
  existingPRDs: 1
  projectDocs: 2
classification:
  projectType: Real-Time Marketplace Platform — Service Category Expansion
  domain: On-Demand Vehicle Services
  complexity: Medium
  projectContext: Brownfield — Feature Expansion + Mobile Parity
---

# PRD: Mobile Mechanics as a Service + Open Beta

**Author:** Beel
**Date:** 2026-04-07
**Extends:** `prd.md` (core platform PRD)
**Initiative:** Mobile Mechanics + 2-Month Open Beta + Mobile App Parity

---

## Executive Summary

### Vision

Expand RoadSide GA from emergency roadside assistance into **scheduled on-site vehicle maintenance** — adding a third service category ("mechanics") alongside existing "roadside" and "diagnostics." Launch via a 2-month open beta (April 7 – June 7, 2026) with zero access gates. Simultaneously close all mobile app feature gaps so the Expo/React Native app reaches full parity with the web platform.

### Product Differentiator

**Three Front Doors, One Platform:**
- **Front Door 1 (Emergency Rescue):** Existing — immediate dispatch for roadside emergencies
- **Front Door 2 (Vehicle Diagnostics):** Existing — scheduled pre-purchase inspections
- **Front Door 3 (Mobile Mechanics):** NEW — scheduled on-site maintenance and repairs at the customer's location

No competitor serves all three through one provider network, one booking system, and one trust relationship.

### Target Users

| User | Role | What's New |
|---|---|---|
| Convenience Maintainer | B2C scheduled maintenance customer | NEW persona — books oil changes, brake work at home/office |
| B2B Fleet Manager | Fleet maintenance contracts | NEW use case — bulk scheduled maintenance for delivery/rideshare fleets |
| Beta Tester | Any user during Apr 7 – Jun 7 | All users — ungated access, all payment methods, tracked for conversion |
| Existing personas | Stranded drivers, car buyers, providers, B2B | Mobile app parity — full feature access from phone |

### Key Innovation

- **Observation → Mechanic Upsell Pipeline:** Roadside providers note vehicle issues during service → auto-follow-up links customer to book the matching mechanic service. Zero acquisition cost.
- **Provider idle-time monetization:** Scheduled mechanic work fills gaps between emergency calls, increasing per-provider revenue and platform stickiness.

---

## Success Criteria

### Beta Period Metrics (Apr 7 – Jun 7, 2026)

| Metric | Target | Measurement |
|---|---|---|
| Mechanic service bookings | 50+ | Count of completed bookings with `category = mechanics` |
| Beta user sign-ups | 200+ | Count of rows in `beta_users` table |
| Mobile booking completion rate | >70% | Bookings started vs completed on mobile app |
| Provider mechanic job acceptance | >80% | Accepted / (accepted + rejected) for mechanic dispatches |
| Push notification opt-in | >60% | Device tokens registered / total mobile users |
| Beta NPS | >40 | Post-service survey |

### Leading Indicators

| Signal | Watch For |
|---|---|
| Observation-to-mechanic conversion | % of medium/high observations that lead to a mechanic booking within 14 days |
| Repeat mechanic bookings | % of mechanic customers who book a second service |
| Provider utilization lift | Average jobs/week increase for providers with `mechanics` specialty |
| B2B fleet interest | Inbound inquiries for fleet maintenance contracts |

---

## Product Scope

### In Scope (Beta)

1. **Mechanics service category** — 6 new scheduled-only services
2. **Beta mode** — platform_settings toggle, trust tier bypass, beta user tracking
3. **Mobile app parity** — provider jobs, customer booking, push notifications, real-time tracking, reviews, referrals, observations, inspection reports
4. **Mechanic dispatch** — cron-based pre-dispatch 2 hours before scheduled time
5. **Observation upsell links** — follow-up notifications link to matching mechanic services
6. **Expo push notifications** — device token registration, notification delivery, tap handling

### Out of Scope (Post-Beta)

- Subscription tiers or premium membership plans
- Parts ordering or inventory management
- In-app mechanic-customer chat/messaging
- Multi-city expansion beyond Atlanta
- Mechanic certification verification system
- Customer vehicle maintenance history tracking
- Warranty or guarantee programs for mechanic services
- Invite codes, waitlists, or access gating of any kind

### Rejected Approaches

| Rejected | Why |
|---|---|
| Feature flag system | Over-engineered; `platform_settings` toggle sufficient |
| Invite codes / waitlist | Contradicts "no gating" requirement |
| Subscription fees during beta | Testing workflow, not revenue model |
| Platform-managed parts inventory | Too complex for beta; provider-supplied model simpler |
| Separate `providerType` enum | Existing `specialties` JSONB array handles this |
| Separate mobile mechanic app | One platform, one codebase, category expansion |

---

## User Journeys

### Journey 1: Customer Books Mobile Mechanic Service

**Persona:** Convenience Maintainer — professional who needs an oil change but can't spend half a day at a shop.

```
1. Customer opens app/web → browses services → selects "Mechanics" tab
2. Selects "Oil Change" ($75) → sees "Scheduled Service" badge
3. Enters vehicle info (year, make, model)
4. Enters location (home address via autocomplete or GPS)
5. Selects date/time from calendar picker (no "ASAP" option)
6. Reviews price breakdown → confirms booking
7. Receives confirmation SMS + email
8. 2 hours before appointment: system auto-dispatches nearest mechanic provider
9. Provider accepts → customer gets push notification with provider name + ETA
10. Provider arrives → updates status to "in_progress"
11. Customer sees provider on live tracking map
12. Provider completes service → submits observation checklist
13. Customer pays (any method — beta bypasses trust tier)
14. Customer receives receipt + prompted to leave review
```

**Error paths:**
- No `scheduledAt` provided → 400 error: "Mechanic services require a scheduled date"
- No mechanic provider available at dispatch time → admin notified, booking held for manual assignment
- Provider rejects → cascade to next nearest mechanic provider

### Journey 2: Provider Accepts Mechanic Job (Mobile)

```
1. Provider receives push notification: "New mechanic job: Oil Change at 123 Main St, Sat 10 AM"
2. Opens mobile app → sees job card with details, location, customer vehicle info
3. Taps "Accept" → job moves to "My Jobs" with scheduled time
4. Day of: provider prepares parts (oil, filter) based on vehicle info
5. 30 min before: app reminds provider, shows route to location
6. Provider taps "En Route" → GPS tracking activates
7. Arrives → taps "Arrived" → customer notified
8. Completes work → fills observation checklist (fluid levels, belt condition, etc.)
9. Taps "Complete" → triggers payment + receipt
10. Earns $56.25 (75% of $75) minus ~$30 parts = ~$26 net
```

### Journey 3: Observation Triggers Mechanic Upsell

```
1. Provider completes a jump start → logs observation: "Brakes — worn pads, medium severity"
2. System detects medium+ severity observation matching a mechanic service
3. Auto-sends follow-up to customer (SMS + email):
   "Your provider noticed your brake pads need attention.
    Book a Mobile Brake Service — we come to you. $150."
   [Deep link to booking with brake service pre-selected]
4. Customer taps link → booking form pre-filled with brake service + their vehicle
5. Completes booking → mechanic dispatched on scheduled date
```

### Journey 4: Beta User Experience

```
1. New user signs up (no invite code, no waitlist)
2. System checks beta_mode_active → true
3. All payment methods available immediately (trust tier bypassed)
4. User books any service → auto-enrolled in beta_users table
5. Beta badge visible in admin dashboard
6. Post-beta: admin sets beta_mode_active → false
7. Trust tier enforcement resumes; beta users tracked for conversion outreach
```

### Journey 5: B2B Fleet Maintenance

```
1. Fleet manager contacts RoadSide GA for bulk maintenance
2. Admin creates B2B account with contract: 10 oil changes/month at $65/each
3. B2B bookings use existing perJobRateCents override ($6500)
4. Monthly invoice auto-generated via existing invoice system
5. Providers dispatched per normal mechanic flow
```

---

## Domain-Specific Requirements

### Mechanic Service Catalog

| Service | Slug | Price (cents) | Category | Scheduling | Commission |
|---|---|---|---|---|---|
| Oil Change | `oil-change` | 7500 | mechanics | scheduled | 2500 bp (25%) |
| Brake Pad Replacement | `brake-service` | 15000 | mechanics | scheduled | 2500 bp (25%) |
| Battery Replacement | `battery-replace` | 12000 | mechanics | scheduled | 2500 bp (25%) |
| General Maintenance | `general-maintenance` | 9500 | mechanics | scheduled | 2500 bp (25%) |
| AC Repair & Recharge | `ac-repair` | 13000 | mechanics | scheduled | 2500 bp (25%) |
| Belt Replacement | `belt-replacement` | 11000 | mechanics | scheduled | 2500 bp (25%) |

### Parts Model

- Providers supply their own parts and consumables
- Service prices include standard parts (conventional oil, standard brake pads, etc.)
- Premium parts upgrades (synthetic oil, ceramic pads) handled via admin price override
- Platform does NOT manage inventory during beta

### Provider Economics

| Service | Provider Keeps (75%) | Est. Parts | Provider Net |
|---|---|---|---|
| Oil Change | $56.25 | $25-35 | $21-31 |
| Brake Pads | $112.50 | $30-50 | $62-82 |
| Battery | $90.00 | $40-60 | $30-50 |
| Maintenance | $71.25 | $5-15 | $56-66 |
| AC Repair | $97.50 | $20-30 | $67-77 |
| Belt Replace | $82.50 | $15-30 | $52-67 |

### Mechanic Provider Requirements

- Must have `"mechanics"` in `specialties` JSONB array
- Recruitment target: 5-10 mechanic-capable providers before beta bookings go live
- Three recruitment pools:
  1. Existing providers with mechanic certifications
  2. Independent mobile mechanics from Craigslist/Facebook groups
  3. Shop mechanics seeking side income
- Onboarding uses existing provider registration flow

### Dispatch Rules for Mechanic Services

- Mechanic bookings are always scheduled (never immediate)
- Auto-dispatch fires via cron job **2 hours before `scheduledAt`**
- Matches providers with `"mechanics"` in specialties within dispatch radius
- If no provider accepts: escalate to admin for manual assignment
- Same cascade logic as roadside dispatch (next nearest on rejection)

---

## Functional Requirements

### FR-1: Mechanics Service Category

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | Add `"mechanics"` to `service_category` PostgreSQL enum | P0 |
| FR-1.2 | Add `schedulingMode` column to `services` table (`"immediate"` / `"scheduled"` / `"both"`, default `"both"`) | P0 |
| FR-1.3 | Seed 6 mechanic services with `schedulingMode = "scheduled"` | P0 |
| FR-1.4 | `POST /api/bookings` returns 400 if `scheduledAt` missing for services with `schedulingMode = "scheduled"` | P0 |
| FR-1.5 | `GET /api/services` accepts `?category=` query parameter for filtering | P0 |
| FR-1.6 | `GET /api/services` response includes `schedulingMode` field | P1 |
| FR-1.7 | Add `GET /api/services/categories` endpoint returning categories with counts | P1 |
| FR-1.8 | Each mechanic service has `checklistConfig` JSONB with service-specific items | P1 |

### FR-2: Beta Mode

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Beta config stored in `platform_settings`: `beta_mode_active`, `beta_start_date`, `beta_end_date` | P0 |
| FR-2.2 | `server/api/lib/beta.ts` exports `isBetaActive()` helper reading `platform_settings` | P0 |
| FR-2.3 | `getAllowedPaymentMethods()` returns all methods (tier 2) when beta is active | P0 |
| FR-2.4 | New `beta_users` table: `id`, `userId`, `enrolledAt`, `source`, `convertedAt` | P0 |
| FR-2.5 | Auto-enroll user in `beta_users` on any booking during beta period | P1 |
| FR-2.6 | `GET /api/beta/status` returns beta active state and user enrollment | P1 |
| FR-2.7 | Admin can toggle `beta_mode_active` via business settings UI | P1 |
| FR-2.8 | Admin dashboard shows beta user count and mechanic booking stats | P2 |

### FR-3: Mechanic Dispatch (Cron-Based)

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | Cron job in `server/cron.ts` runs every 15 minutes checking for mechanic bookings with `scheduledAt` within 2 hours | P0 |
| FR-3.2 | Cron triggers `autoDispatchBooking()` for eligible mechanic bookings (status = `confirmed`, not yet dispatched) | P0 |
| FR-3.3 | Dispatch matches providers with `"mechanics"` in specialties array | P0 |
| FR-3.4 | Failed dispatch (no providers) creates dispatch log and notifies admin | P1 |

### FR-4: Observation → Mechanic Upsell

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | When observation with medium/high severity is submitted, match observation category to mechanic service (e.g., "Brakes" → `brake-service`) | P1 |
| FR-4.2 | Follow-up SMS/email includes deep link to booking form with mechanic service pre-selected | P1 |
| FR-4.3 | Deep link includes `serviceId` and customer's `vehicleInfo` from original booking | P2 |

### FR-5: Mobile Push Notifications

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | `POST /api/push/register-device` accepts `{ expoPushToken, platform }` and stores device token | P0 |
| FR-5.2 | `DELETE /api/push/unregister-device` removes device token | P0 |
| FR-5.3 | Notification dispatch layer sends via Expo Push API for mobile tokens, web-push for browser tokens | P0 |
| FR-5.4 | Push sent on: booking created, provider dispatched, provider arrived, service completed, booking cancelled | P0 |
| FR-5.5 | Push sent to provider on: job assigned, job cancelled by customer | P0 |

### FR-6: Mobile App Parity

| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | Services screen shows category tabs: Roadside / Diagnostics / Mechanics | P0 |
| FR-6.2 | Booking flow enforces date picker (no ASAP) for mechanic services | P0 |
| FR-6.3 | Provider can accept/reject jobs with full job card details | P0 |
| FR-6.4 | Provider can update job status through lifecycle | P0 |
| FR-6.5 | Provider GPS location tracking (30s intervals) | P0 |
| FR-6.6 | Customer real-time tracking map showing provider location | P1 |
| FR-6.7 | Provider observation submission form with photo capture | P1 |
| FR-6.8 | Provider inspection report form with structured findings | P1 |
| FR-6.9 | Referral code sharing via native Share API | P1 |
| FR-6.10 | Referral credit balance display | P1 |
| FR-6.11 | Review submission after completed booking | P1 |
| FR-6.12 | Push notification permission request flow on first launch | P0 |
| FR-6.13 | Notification tap navigates to relevant booking detail screen | P1 |

---

## Non-Functional Requirements

### Performance

| ID | Requirement |
|---|---|
| NFR-1 | Mechanic dispatch cron completes full scan in <5 seconds |
| NFR-2 | Push notification delivery within 3 seconds of event trigger |
| NFR-3 | Mobile app cold start <2 seconds on mid-range devices |
| NFR-4 | Live tracking map updates provider position within 2 seconds of GPS update |

### Security

| ID | Requirement |
|---|---|
| NFR-5 | Expo push tokens stored securely, associated with authenticated userId |
| NFR-6 | Beta mode bypass logged in audit trail (action: `beta_trust_bypass`) |
| NFR-7 | Device token registration requires valid JWT session |

### Reliability

| ID | Requirement |
|---|---|
| NFR-8 | Beta mode toggle is atomic — no partial state between settings rows |
| NFR-9 | Mechanic dispatch cron is idempotent — re-running does not double-dispatch |
| NFR-10 | Push notification failures are fire-and-forget with error logging (no retry storms) |

### Data

| ID | Requirement |
|---|---|
| NFR-11 | `beta_users` table retains data after beta ends for conversion analysis |
| NFR-12 | All mechanic bookings tagged with `category = mechanics` for analytics filtering |
| NFR-13 | Enum migration (`ALTER TYPE ... ADD VALUE`) is non-destructive to existing data |

---

## Phased Development (4 Sprints)

> **Note:** This sprint plan is a high-level guide. For authoritative story-to-sprint assignments, see `epics.md` (Epics 16–19) and `sprint-status.yaml`. Mobile features were reorganized to follow backend-first sequencing.

### Sprint 1: Foundation (Apr 7–20)

**Goal:** Schema changes live, mechanic services seeded, beta mode active, mobile service categories.

| Deliverable | Type |
|---|---|
| Add `mechanics` to service_category enum + migration | Backend |
| Add `schedulingMode` column to services table | Backend |
| Create `beta_users` table + migration | Backend |
| Seed 6 mechanic services | Backend |
| Insert beta config rows in platform_settings | Backend |
| Create `server/api/lib/beta.ts` helper | Backend |
| Add trust tier beta bypass in `getAllowedPaymentMethods()` | Backend |
| Add `?category=` filter to `GET /api/services` | Backend |
| Mobile: update Service types, add category tabs to services screen | Mobile |

### Sprint 2: Booking + Push (Apr 21 – May 4)

**Goal:** Mechanic booking flow works end-to-end on web and mobile with push notifications.

| Deliverable | Type |
|---|---|
| Enforce `scheduledAt` for mechanic bookings in `POST /api/bookings` | Backend |
| Beta user auto-enrollment on booking | Backend |
| Mechanic pre-dispatch cron job in `server/cron.ts` | Backend |
| `POST /api/push/register-device` + `DELETE /api/push/unregister-device` | Backend |
| Expo push notification delivery in notification dispatch layer | Backend |
| `GET /api/beta/status` endpoint | Backend |
| Mobile: mechanic booking flow with date picker, no ASAP | Mobile |
| Mobile: `expo-notifications` setup, token registration, tap handling | Mobile |
| Web: mechanic services visible in booking form with scheduled-only enforcement | Web |

### Sprint 3: Provider Parity (May 5–18)

**Goal:** Providers can do everything from mobile. Observation upsell pipeline live.

| Deliverable | Type |
|---|---|
| Observation → mechanic upsell matching + deep links in follow-up notifications | Backend |
| Mobile: provider observation form with photo capture (`expo-image-picker`) | Mobile |
| Mobile: provider inspection report form | Mobile |
| Mobile: customer real-time tracking map (`react-native-maps`) | Mobile |
| Mobile: provider GPS tracking component | Mobile |
| Mobile: provider job accept/reject + status updates | Mobile |

### Sprint 4: Polish + Analytics (May 19 – Jun 7)

**Goal:** Remaining mobile parity, beta analytics, bug fixes from real usage.

| Deliverable | Type |
|---|---|
| Mobile: referral feature (share, credits, deep links) | Mobile |
| Mobile: review submission (verify existing `review.tsx` works end-to-end) | Mobile |
| Admin: beta dashboard (user count, mechanic stats, conversion tracking) | Web |
| Admin: beta mode toggle in business settings | Web |
| Bug fixes from beta user feedback | All |
| Performance optimization based on real usage patterns | All |

---

## Technical Implementation Notes

These are guidance notes for the architecture and implementation phases — not requirements.

### Schema Changes Summary

| Change | File | Migration |
|---|---|---|
| Add `"mechanics"` to `service_category` enum | `db/schema/services.ts` | `ALTER TYPE service_category ADD VALUE 'mechanics'` |
| Add `schedulingMode` text column | `db/schema/services.ts` | New column, default `"both"` |
| Create `beta_users` table | `db/schema/beta-users.ts` (new) | New table |
| Device token storage | `db/schema/push-subscriptions.ts` or new | Extend or new table |

### API Changes Summary

| Endpoint | Action |
|---|---|
| `GET /api/services` | Add `?category=` filter, include `schedulingMode` |
| `POST /api/bookings` | Validate `scheduledAt` for mechanic services, beta enrollment |
| `GET /api/services/categories` | New — category list with counts |
| `GET /api/beta/status` | New — beta state + user enrollment |
| `POST /api/push/register-device` | New — Expo push token |
| `DELETE /api/push/unregister-device` | New — remove token |

### Key Integration Points

- **Trust tier**: `server/api/lib/trust-tier.ts` — single `isBetaActive()` check in `getAllowedPaymentMethods()`
- **Dispatch**: `server/api/lib/auto-dispatch.ts` — existing specialty matching works; cron handles timing
- **Notifications**: `lib/notifications/` — add Expo Push API alongside existing web-push + Twilio + Resend
- **Cron**: `server/cron.ts` — add mechanic pre-dispatch job (every 15 min, 2hr lookahead)
- **Observations**: `server/api/routes/observations.ts` — add mechanic service matching to follow-up logic
