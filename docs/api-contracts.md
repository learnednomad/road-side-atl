# API Contracts - RoadSide ATL

> Generated: 2026-02-11 | Scan Level: Exhaustive | Framework: Hono 4.11.7 | Total Endpoints: 70+

## Overview

The API is built with Hono, mounted via Next.js catch-all route (`app/api/[[...route]]/route.ts`). All routes are prefixed with `/api`. Authentication uses NextAuth.js JWT sessions with role-based middleware.

## Authentication & Middleware

### Auth Middleware (`server/api/middleware/auth.ts`)

| Middleware | Requirement |
|---|---|
| `requireAuth` | Valid session with user.id |
| `requireAdmin` | user.role === "admin" |
| `requireProvider` | user.role === "provider" |

### Rate Limiting (`server/api/middleware/rate-limit.ts`)

| Tier | Limit | Use Case |
|---|---|---|
| `standard` | 100 req/min | General API access |
| `strict` | 20 req/min | Sensitive operations |
| `auth` | 10 req/5 min | Login/register/reset |
| `notifications` | 5 req/min | Push notification ops |
| `webhooks` | 200 req/min | Stripe webhook processing |

---

## Route Groups

### 1. Authentication (`/api/auth-routes`)

| Method | Path | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/register` | None | auth | Create user account with email verification |
| POST | `/verify-email` | None | - | Verify email token |
| POST | `/resend-verification` | None | auth | Resend verification email |
| POST | `/forgot-password` | None | auth | Send password reset link |
| POST | `/verify-reset-token` | None | - | Check if reset token is valid |
| POST | `/reset-password` | None | auth | Complete password reset |

### 2. NextAuth (`/api/auth/[...nextauth]`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/auth/*` | - | NextAuth.js session management |

### 3. Services (`/api/services`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | None | List active services |

### 4. Bookings (`/api/bookings`)

| Method | Path | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/` | Optional | strict | Create booking (guest or authenticated) |
| GET | `/` | requireAuth | - | List user's bookings |
| GET | `/:id` | requireAuth | - | Get booking detail |
| PATCH | `/:id/cancel` | requireAuth | - | Cancel pending/confirmed booking |

**POST /bookings body:**
```typescript
{
  serviceId: string
  vehicleInfo: { year: number, make: string, model: string }
  location: { address: string, latitude?: number, longitude?: number, placeId?: string, destination?: string, destinationLatitude?: number, destinationLongitude?: number, estimatedMiles?: number }
  contactName: string
  contactPhone: string
  contactEmail: string
  scheduledAt?: string
  notes?: string
}
```

### 5. Payments (`/api/payments`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/stripe/checkout` | None | Create Stripe checkout session |

### 6. Webhooks (`/api/webhooks`)

| Method | Path | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/stripe` | Stripe signature | webhooks | Handle Stripe events (checkout.session.completed, charge.refunded, checkout.session.expired) |

### 7. Provider (`/api/provider`)

All routes require `requireProvider`.

| Method | Path | Description |
|---|---|---|
| GET | `/jobs` | List assigned jobs (paginated, filterable by status) |
| GET | `/jobs/:id` | Get job detail |
| PATCH | `/jobs/:id/accept` | Accept job assignment |
| PATCH | `/jobs/:id/reject` | Reject job (triggers auto-dispatch retry) |
| PATCH | `/jobs/:id/status` | Update job status |
| POST | `/location` | Update provider GPS location |
| GET | `/stats` | Get provider statistics |
| GET | `/profile` | Get provider profile |
| PATCH | `/profile` | Update provider profile |
| PATCH | `/availability` | Toggle online/offline |

### 8. Customer (`/api/customer`)

All routes require `requireAuth`.

| Method | Path | Description |
|---|---|---|
| GET | `/bookings` | List customer bookings (paginated) |
| GET | `/bookings/export` | Export bookings as CSV |
| GET | `/bookings/:id` | Get booking detail with review status |

### 9. Reviews (`/api/reviews`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/provider/:providerId` | None | List provider reviews (paginated) |
| POST | `/` | requireAuth | Create review (1-5 rating + optional comment) |
| GET | `/booking/:bookingId` | requireAuth | Get review for booking |
| PATCH | `/:reviewId` | requireAuth | Update own review |
| DELETE | `/:reviewId` | requireAdmin | Delete review (admin only) |

### 10. Receipts (`/api/receipts`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:bookingId` | None | Generate receipt HTML |
| GET | `/:bookingId/download` | None | Download receipt as HTML file |

### 11. Geocoding (`/api/geocoding`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/address` | None | Geocode address to lat/lng via Google Maps |

### 12. Provider Registration (`/api/provider-registration`)

| Method | Path | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/verify-invite` | None | auth | Verify provider invite token |
| POST | `/accept-invite` | None | auth | Accept invite and create account |
| POST | `/register` | None | auth | Self-register as provider (pending approval) |

### 13. Push Notifications (`/api/push`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vapid-public-key` | None | Get VAPID public key |
| POST | `/subscribe` | requireAuth | Subscribe to push notifications |
| POST | `/unsubscribe` | requireAuth | Unsubscribe from push |
| GET | `/status` | requireAuth | Get subscription status |
| POST | `/resubscribe` | None | Update subscription endpoint |

### 14. Admin (`/api/admin`)

All routes require `requireAdmin`.

| Method | Path | Rate Limit | Description |
|---|---|---|---|
| GET | `/stats` | standard | Dashboard statistics |
| GET | `/stats/sparklines` | standard | 7-day trend data for charts |
| GET | `/bookings` | standard | List bookings (paginated, filterable, searchable) |
| PATCH | `/bookings/:id/assign-provider` | strict | Assign provider to booking |
| PATCH | `/bookings/:id/status` | strict | Update booking status (auto-dispatch on confirm) |
| PATCH | `/payments/:id/confirm` | strict | Confirm manual payment |
| POST | `/bookings/:id/confirm-payment` | strict | Create + confirm payment record |
| GET | `/revenue/analytics` | standard | Revenue analytics with date range |
| GET | `/revenue` | standard | Revenue summary |
| GET | `/bookings/export` | standard | Export bookings CSV |
| GET | `/revenue/export` | standard | Export revenue CSV |
| GET | `/customers` | standard | List customers (searchable, paginated) |
| GET | `/audit-logs` | standard | Query audit logs with filters |

### 15. Admin Providers (`/api/admin/providers`)

All routes require `requireAdmin`.

| Method | Path | Description |
|---|---|---|
| GET | `/` | List providers (filterable by status) |
| GET | `/:id` | Get provider detail with earnings |
| POST | `/` | Create provider profile |
| PATCH | `/:id` | Update provider |
| DELETE | `/:id` | Soft-delete provider (set inactive) |
| GET | `/:id/payouts` | Provider payout history |
| POST | `/:id/invite` | Send email invite to provider |
| GET | `/:id/invite-status` | Check invite status |

### 16. Admin Payouts (`/api/admin/payouts`)

All routes require `requireAdmin`.

| Method | Path | Description |
|---|---|---|
| GET | `/` | List payouts (filterable by status/provider) |
| POST | `/mark-paid` | Batch mark payouts as paid |
| GET | `/summary` | Payout aggregate statistics |

---

## WebSocket Server

**Endpoint:** `ws://host:3000/ws`

### Authentication Flow

1. Client connects to WebSocket
2. Must send auth message within 10 seconds: `{ "type": "auth", "userId": string, "role": string }`
3. Server responds: `{ "type": "auth:success" }`

### Event Types

| Event | Direction | Description |
|---|---|---|
| `booking:created` | Server → Admins | New booking created |
| `booking:status_changed` | Server → User/Admin | Booking status updated |
| `provider:job_assigned` | Server → Provider | New job assigned |
| `provider:location_updated` | Server → Admins | Provider GPS update |
| `pong` | Server → Client | Heartbeat response |

### Broadcast Functions

- `broadcastToAdmins(event)` — All admin connections
- `broadcastToProvider(providerId, event)` — Specific provider
- `broadcastToUser(userId, event)` — Specific user

**Heartbeat:** Ping every 30 seconds, auto-disconnect stale connections.

---

## Server-Side Libraries

### Auto-Dispatch (`server/api/lib/auto-dispatch.ts`)

- Triggered when booking status changes to "confirmed"
- Finds nearest active + available providers within `MAX_DISPATCH_DISTANCE_MILES` (default: 50)
- Prioritizes specialty match
- Creates dispatch_log audit trail

### Payout Calculator (`server/api/lib/payout-calculator.ts`)

- Triggered when booking completes with confirmed payment
- Calculates: `percentage` → `(payment * commissionRate) / 10000` | `flat_per_job` → `flatFeeAmount`
- Creates provider_payout record with status "pending"

### Audit Logger (`server/api/lib/audit-logger.ts`)

- Buffered write (batch every 1s or 50 entries)
- Auto-creates `audit_logs` table if not exists
- Tracks 20+ action types across bookings, providers, payments, users, dispatch

### Rate Limiter (`server/api/lib/rate-limiter.ts`)

- In-memory sliding window implementation
- Per-IP tracking with configurable window and max requests
