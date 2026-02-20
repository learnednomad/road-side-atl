# Architecture - RoadSide ATL

> Generated: 2026-02-11 | Scan Level: Exhaustive

## Executive Summary

RoadSide ATL is a full-stack roadside assistance platform built as a Next.js 16 monolith serving the Atlanta metro area. It provides a customer-facing booking system, a provider dispatch portal with real-time GPS tracking, and an admin management dashboard. The application uses a layered architecture with route groups for role isolation, a Hono-based REST API, WebSocket for real-time updates, and PostgreSQL for persistence.

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | Next.js (App Router) | 16.1.6 |
| UI Library | React | 19.2.3 |
| Language | TypeScript | 5.x |
| API Framework | Hono | 4.11.7 |
| Database | PostgreSQL | 16 |
| ORM | Drizzle ORM | 0.45.1 |
| Authentication | NextAuth.js | 5.0.0-beta.30 |
| Styling | Tailwind CSS + shadcn/ui | 4.x / 1.4.3 |
| Real-time | WebSocket (ws) | 8.19.0 |
| Payments | Stripe | 20.3.0 |
| Maps | Google Maps JS API | 2.0.2 |
| SMS | Twilio | 5.12.0 |
| Email | Resend | 6.9.1 |
| Push Notifications | web-push (VAPID) | 3.6.7 |
| Containerization | Docker | Multi-stage |

## Architecture Pattern

**Type:** Layered Monolith with Role-Based Route Groups

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Marketing│ │  Admin   │ │ Provider │ │   Customer    │  │
│  │  Pages   │ │  Portal  │ │  Portal  │ │   Dashboard   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘  │
│       │             │            │               │          │
│  ┌────┴─────────────┴────────────┴───────────────┴────────┐ │
│  │              SHARED COMPONENTS LAYER                    │ │
│  │  UI (shadcn) | Maps | Forms | Notifications | SEO      │ │
│  └────────────────────────┬───────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                      API LAYER                              │
│  ┌────────────────────────┴───────────────────────────────┐ │
│  │                    Hono Router                          │ │
│  │  /api/services | /api/bookings | /api/admin | ...       │ │
│  └────────┬───────────────────────────────┬───────────────┘ │
│  ┌────────┴────────┐             ┌────────┴────────┐        │
│  │   Middleware     │             │  Server Libs    │        │
│  │  Auth | Rate     │             │  Auto-Dispatch  │        │
│  │  Limit           │             │  Payout Calc    │        │
│  └─────────────────┘             │  Audit Logger   │        │
│                                  └─────────────────┘        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                    DATA LAYER                               │
│  ┌────────────────────────┴───────────────────────────────┐ │
│  │                  Drizzle ORM                            │ │
│  │  14 tables | 10 enums | Schema-first approach           │ │
│  └────────────────────────┬───────────────────────────────┘ │
│  ┌────────────────────────┴───────────────────────────────┐ │
│  │                  PostgreSQL 16                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                  REAL-TIME LAYER                            │
│  ┌────────────────────────┴───────────────────────────────┐ │
│  │              WebSocket Server (ws)                      │ │
│  │  Auth | Heartbeat | Role-based Broadcasting             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Route Group Architecture

The app uses Next.js route groups for role-based isolation:

| Group | Path Prefix | Auth | Purpose |
|---|---|---|---|
| `(marketing)` | `/` | Public | Landing, services, booking, tracking |
| `(auth)` | `/login`, `/register`, etc. | Public | Authentication flows |
| `(admin)` | `/admin/*` | Admin only | Platform management |
| `(provider)` | `/provider/*` | Provider only | Job management |
| `(dashboard)` | `/dashboard` | Authenticated | Redirects to role-based home |

Route protection is handled by `proxy.ts` (NextAuth middleware):
- Logged-in users redirected away from `/login`, `/register`
- `/admin/*` restricted to admin role
- `/provider/*` restricted to provider role
- `/dashboard` redirects to role-specific home

## Data Architecture

### Database Schema (14 tables)

**Core Business:**
- `users` — Multi-role user accounts (customer/admin/provider)
- `services` — Service catalog with pricing
- `providers` — Provider profiles with commission, location, ratings
- `bookings` — Service requests with status workflow
- `payments` — Payment records (cash/cashapp/zelle/stripe)
- `provider_payouts` — Provider earnings tracking
- `dispatch_logs` — Auto-dispatch audit trail
- `reviews` — Customer ratings and reviews

**Infrastructure:**
- `accounts` — OAuth provider accounts (NextAuth)
- `sessions` — User sessions (NextAuth)
- `verification_tokens` — Email verification
- `password_reset_tokens` — Password reset flow
- `push_subscriptions` — Web push endpoints
- `provider_invite_tokens` — Provider onboarding invites

### Booking Status Workflow

```
pending → confirmed → dispatched → in_progress → completed
    └─────────────────────────────────────────→ cancelled
```

### Payment Flow

```
Booking Created
    │
    ├── Stripe → Checkout Session → Webhook confirms → Payout created
    ├── Cash/CashApp/Zelle → Admin manually confirms → Payout created
    │
    └── Payout: pending → paid (batch by admin)
```

## API Design

### Hono REST API

The API is mounted via a Next.js catch-all route (`app/api/[[...route]]/route.ts`) that delegates to Hono. This approach:
- Keeps API logic separate from Next.js pages
- Enables middleware composition (auth, rate limiting)
- Supports all HTTP methods through a single route file

**Route organization:** 15 route modules with 70+ endpoints covering services, bookings, admin, provider, customer, payments, webhooks, reviews, receipts, geocoding, registration, and push notifications.

### WebSocket Architecture

A custom Node.js HTTP server (`server-custom.ts`) handles WebSocket upgrades alongside Next.js requests:

1. HTTP requests → Next.js handler
2. WebSocket upgrades → Custom WS server
3. WS connections authenticated within 10s timeout
4. Heartbeat ping every 30s
5. Role-based broadcasting (admins, specific provider, specific user)

## Authentication & Authorization

### Auth Providers
- **Google OAuth** — Social login
- **Credentials** — Email + bcrypt password
- **Resend** — Magic link (optional, env-dependent)

### Session Strategy
- JWT-based sessions (not database sessions)
- Role injected into JWT token from database on login
- Middleware checks: `requireAuth`, `requireAdmin`, `requireProvider`

### Email Verification
- Required for customers and providers (not admins)
- 24-hour token expiry
- HTML email with verification link

### Provider Onboarding
1. **Admin invite:** Admin creates provider → sends invite email → provider accepts (72h expiry) → auto-activated
2. **Self-registration:** Provider applies → email verification → pending admin approval

## Notification Architecture

Three parallel notification channels:

| Channel | Provider | Rate Limit | Use Case |
|---|---|---|---|
| Email | Resend | None | Booking confirmations, status updates, invites |
| SMS | Twilio | 1/phone/60s | Booking confirmations, provider assignments |
| Web Push | VAPID | None | Real-time status changes, new job alerts |

Notifications are dispatched in parallel via `Promise.allSettled()` and fail silently if unconfigured.

## Deployment Architecture

### Docker Configuration

Multi-stage Dockerfile:
1. **deps** — Install all dependencies (including dev)
2. **builder** — Build Next.js + compile custom server
3. **runner** — Production image with standalone output

### Container Startup (`docker-entrypoint.sh`)
1. Wait for PostgreSQL readiness
2. Ensure migration tracking schema exists
3. Seed prior migrations if tables exist (backward compatibility)
4. Run database migrations
5. Start Node.js server

### Docker Compose Services
- **app** — Next.js application (port 3000)
- **db** — PostgreSQL 16 Alpine (port 5432)
- **network** — Bridge network for inter-service communication

### Health Check
```
GET /api/services → HTTP 200
Interval: 30s | Timeout: 10s | Start Period: 60s | Retries: 3
```

## SEO Architecture

- **Structured Data:** LocalBusiness, WebSite, FAQ, Breadcrumb, Service JSON-LD schemas
- **Geo-Targeting:** Atlanta metro area with neighborhood-level keywords (60+)
- **Dynamic Sitemap:** Auto-generated from routes with priorities
- **robots.txt:** Blocks admin, provider, and auth routes from indexing
- **PWA Manifest:** App-like experience with push notifications

## State Management Patterns

| Pattern | Usage |
|---|---|
| Server Components | Database queries, static content |
| Client State (useState) | Forms, UI interactions, filters |
| WebSocket Context | Real-time updates (booking status, provider location) |
| NextAuth Session | Authentication state |
| react-hook-form + Zod | Form validation (booking, provider, auth) |
| URL Search Params | Pagination, filters |

## Testing Strategy

No test files were found in the project. The codebase currently has no automated tests.

## Key Design Decisions

1. **Hono over Next.js API routes** — Better middleware composition, cleaner route organization, framework-agnostic API logic
2. **Drizzle ORM over Prisma** — Lighter weight, SQL-like query builder, better TypeScript inference
3. **JWT over database sessions** — Stateless auth, reduced database queries
4. **WebSocket via custom server** — Full-duplex real-time without third-party services
5. **Multi-payment methods** — Cash/CashApp/Zelle for local market + Stripe for online
6. **Route groups** — Clean role isolation without path prefixes in URLs
7. **Standalone Docker output** — Optimized container size, no need for full node_modules
8. **Auto-dispatch algorithm** — Nearest available provider with specialty matching
9. **Audit logging** — Buffered writes for performance, comprehensive action tracking
10. **Multi-tenancy ready** — `tenantId` columns present but not enforced (future-proofing)
