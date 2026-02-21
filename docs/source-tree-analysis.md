# Source Tree Analysis - RoadSide ATL

> Generated: 2026-02-11 | Scan Level: Exhaustive

## Annotated Directory Tree

```
road-side-atl/
├── app/                            # Next.js App Router (47 files)
│   ├── (admin)/                    # Admin portal route group
│   │   ├── layout.tsx              # Admin layout: sidebar + mobile nav
│   │   └── admin/
│   │       ├── page.tsx            # Dashboard overview (server-rendered)
│   │       ├── error.tsx           # Admin error boundary
│   │       ├── overview-client.tsx # Dashboard client with sparklines
│   │       ├── audit-logs/
│   │       │   ├── page.tsx        # Audit log page (admin-only check)
│   │       │   └── audit-logs-client.tsx # Filterable audit log viewer
│   │       ├── bookings/
│   │       │   ├── page.tsx        # Bookings table with pagination
│   │       │   └── [id]/
│   │       │       └── page.tsx    # Booking detail view
│   │       ├── calendar/
│   │       │   └── page.tsx        # Calendar view of bookings
│   │       ├── customers/
│   │       │   └── page.tsx        # Customer management table
│   │       ├── payouts/
│   │       │   └── page.tsx        # Provider payout management
│   │       ├── providers/
│   │       │   ├── page.tsx        # Provider CRUD table
│   │       │   └── [id]/
│   │       │       └── page.tsx    # Provider detail + earnings
│   │       └── revenue/
│   │           └── page.tsx        # Revenue analytics dashboard
│   │
│   ├── (auth)/                     # Authentication route group
│   │   ├── error/
│   │   │   └── page.tsx            # Auth error page
│   │   ├── forgot-password/
│   │   │   └── page.tsx            # Password reset request
│   │   ├── login/
│   │   │   └── page.tsx            # Login (credentials/Google/magic link)
│   │   ├── register/
│   │   │   ├── page.tsx            # Customer registration
│   │   │   └── provider/
│   │   │       ├── page.tsx        # Provider self-registration
│   │   │       └── invite/
│   │   │           └── page.tsx    # Accept admin invite
│   │   ├── reset-password/
│   │   │   └── page.tsx            # Complete password reset
│   │   └── verify-email/
│   │       └── page.tsx            # Email verification endpoint
│   │
│   ├── (dashboard)/                # Generic dashboard redirect
│   │   ├── layout.tsx              # Reuses marketing layout
│   │   └── dashboard/
│   │       └── page.tsx            # Redirects to /my-bookings
│   │
│   ├── (marketing)/                # Public marketing pages
│   │   ├── layout.tsx              # Navbar + Footer wrapper
│   │   ├── page.tsx                # Homepage with SEO schemas
│   │   ├── about/
│   │   │   └── page.tsx            # About page
│   │   ├── book/
│   │   │   ├── page.tsx            # Multi-step booking form
│   │   │   └── confirmation/
│   │   │       └── page.tsx        # Booking confirmation + payment
│   │   ├── my-bookings/
│   │   │   ├── page.tsx            # User bookings (auth required)
│   │   │   ├── error.tsx           # Bookings error boundary
│   │   │   └── my-bookings-client.tsx # Real-time booking list
│   │   ├── services/
│   │   │   └── page.tsx            # Services listing
│   │   └── track/
│   │       └── [id]/
│   │           ├── page.tsx        # Tracking server wrapper
│   │           └── tracking-client.tsx # Live tracking with map
│   │
│   ├── (provider)/                 # Provider portal route group
│   │   ├── layout.tsx              # Provider layout: sidebar + mobile nav
│   │   └── provider/
│   │       ├── page.tsx            # Provider dashboard with real-time jobs
│   │       ├── jobs/
│   │       │   ├── page.tsx        # Job history with filters
│   │       │   └── [id]/
│   │       │       └── page.tsx    # Job detail with status controls
│   │       └── settings/
│   │           └── page.tsx        # Provider profile & settings
│   │
│   ├── api/                        # API routes
│   │   ├── [[...route]]/
│   │   │   └── route.ts            # ★ ENTRY POINT: Hono catch-all handler
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts        # NextAuth.js handler
│   │
│   ├── layout.tsx                  # ★ ROOT LAYOUT: providers, fonts, SEO
│   ├── globals.css                 # Tailwind + theme CSS variables
│   ├── manifest.ts                 # PWA manifest
│   ├── robots.ts                   # SEO robots.txt
│   ├── sitemap.ts                  # Dynamic sitemap
│   └── favicon.ico
│
├── components/                     # React components (59 files)
│   ├── admin/                      # Admin panel components (13 files)
│   │   ├── sidebar.tsx             # Desktop sidebar nav
│   │   ├── admin-mobile-nav.tsx    # Mobile drawer nav
│   │   ├── bookings-table.tsx      # Main bookings management table
│   │   ├── customers-table.tsx     # Customer management
│   │   ├── date-range-picker.tsx   # Date range selector with presets
│   │   ├── export-button.tsx       # CSV export button
│   │   ├── payouts-table.tsx       # Payout management with batch ops
│   │   ├── provider-form.tsx       # Provider create/edit form
│   │   ├── providers-table.tsx     # Provider CRUD table
│   │   ├── revenue-analytics.tsx   # Revenue dashboard with charts
│   │   ├── revenue-charts.tsx      # Chart components (line/bar/pie)
│   │   └── stats-cards.tsx         # Dashboard stat cards with sparklines
│   │
│   ├── booking/                    # Booking flow (2 files)
│   │   ├── booking-form.tsx        # 4-step booking wizard
│   │   └── payment-instructions.tsx # Payment method display
│   │
│   ├── dashboard/                  # Customer dashboard (2 files)
│   │   ├── booking-list.tsx        # Booking cards list
│   │   └── status-badge.tsx        # Status badge component
│   │
│   ├── maps/                       # Google Maps (3 files)
│   │   ├── address-autocomplete.tsx # Places autocomplete input
│   │   ├── bookings-map.tsx        # Admin bookings map view
│   │   └── live-tracking-map.tsx   # Real-time tracking map
│   │
│   ├── marketing/                  # Landing page (4 files)
│   │   ├── hero.tsx                # Hero section
│   │   ├── navbar.tsx              # Main navigation (responsive)
│   │   ├── service-card.tsx        # Service offering card
│   │   └── footer.tsx              # Site footer
│   │
│   ├── notifications/              # Push notifications (1 file)
│   │   └── push-notification-toggle.tsx # Subscribe/unsubscribe toggle
│   │
│   ├── provider/                   # Provider portal (5 files)
│   │   ├── job-card.tsx            # Job display with actions
│   │   ├── location-tracker.tsx    # GPS location tracking toggle
│   │   ├── provider-mobile-nav.tsx # Mobile drawer nav
│   │   ├── provider-sidebar.tsx    # Desktop sidebar nav
│   │   └── status-updater.tsx      # Job status transition buttons
│   │
│   ├── providers/                  # Context providers (3 files)
│   │   ├── session-provider.tsx    # NextAuth SessionProvider wrapper
│   │   ├── websocket-provider.tsx  # WebSocket context + useWS hook
│   │   └── websocket-wrapper.tsx   # Session-aware WS wrapper
│   │
│   ├── reviews/                    # Review system (3 files)
│   │   ├── review-form.tsx         # Star rating + comment form
│   │   ├── reviews-list.tsx        # Paginated review list
│   │   └── star-rating.tsx         # Star rating display
│   │
│   ├── seo/                        # SEO (1 file)
│   │   └── json-ld.tsx             # JSON-LD schema components
│   │
│   └── ui/                         # shadcn/ui primitives (22 files)
│       ├── alert-dialog.tsx        ├── avatar.tsx
│       ├── badge.tsx               ├── button.tsx
│       ├── calendar.tsx            ├── card.tsx
│       ├── checkbox.tsx            ├── dialog.tsx
│       ├── dropdown-menu.tsx       ├── form.tsx
│       ├── input.tsx               ├── label.tsx
│       ├── popover.tsx             ├── select.tsx
│       ├── separator.tsx           ├── sheet.tsx
│       ├── skeleton.tsx            ├── sonner.tsx
│       ├── switch.tsx              ├── table.tsx
│       ├── tabs.tsx                └── textarea.tsx
│
├── server/                         # Backend server (25 files)
│   ├── api/
│   │   ├── index.ts                # ★ ENTRY POINT: Hono app with all routes
│   │   ├── lib/
│   │   │   ├── audit-logger.ts     # Buffered audit log writer
│   │   │   ├── auto-dispatch.ts    # Nearest-provider dispatch algorithm
│   │   │   ├── payout-calculator.ts # Commission calculation
│   │   │   └── rate-limiter.ts     # In-memory rate limiting
│   │   ├── middleware/
│   │   │   ├── auth.ts             # Auth middleware (requireAuth/Admin/Provider)
│   │   │   └── rate-limit.ts       # Rate limit middleware configs
│   │   └── routes/
│   │       ├── admin.ts            # Admin dashboard, bookings, revenue
│   │       ├── admin-payouts.ts    # Payout management
│   │       ├── admin-providers.ts  # Provider CRUD + invites
│   │       ├── auth.ts             # Registration, verification, password reset
│   │       ├── bookings.ts         # Booking CRUD
│   │       ├── customer.ts         # Customer booking views
│   │       ├── geocoding.ts        # Address geocoding
│   │       ├── payments.ts         # Stripe checkout
│   │       ├── provider.ts         # Provider jobs, location, profile
│   │       ├── provider-registration.ts # Invite accept + self-register
│   │       ├── push.ts             # Push notification subscriptions
│   │       ├── receipts.ts         # Receipt generation
│   │       ├── reviews.ts          # Review CRUD
│   │       ├── services.ts         # Service catalog
│   │       └── webhooks.ts         # Stripe webhook handler
│   └── websocket/
│       ├── server.ts               # WS server setup + upgrade handler
│       ├── connections.ts          # Connection pool management
│       ├── broadcast.ts            # Event broadcasting functions
│       └── types.ts                # WS event type definitions
│
├── db/                             # Database layer (23 files)
│   ├── index.ts                    # ★ DB connection (drizzle + postgres.js)
│   ├── seed.ts                     # Demo data seeder
│   ├── schema/
│   │   ├── index.ts                # Schema barrel export
│   │   ├── users.ts                # Users table + relations
│   │   ├── services.ts             # Services table + relations
│   │   ├── providers.ts            # Providers table + relations
│   │   ├── bookings.ts             # Bookings table + relations
│   │   ├── payments.ts             # Payments table + relations
│   │   ├── provider-payouts.ts     # Payouts table + relations
│   │   ├── dispatch-logs.ts        # Dispatch audit table + relations
│   │   ├── reviews.ts              # Reviews table + relations
│   │   ├── push-subscriptions.ts   # Push subscriptions table + relations
│   │   ├── auth.ts                 # NextAuth + invite tables + relations
│   │   └── utils.ts                # UUID generation helper
│   └── migrations/
│       ├── 0000_brainy_mysterio.sql
│       ├── 0001_pretty_ogun.sql
│       ├── 0002_numerous_peter_parker.sql
│       ├── 0003_condemned_james_howlett.sql
│       └── meta/                   # Migration snapshots + journal
│
├── lib/                            # Shared library code (19 files)
│   ├── auth.ts                     # ★ NextAuth configuration
│   ├── auth.config.ts              # Auth providers (Google, Credentials, Resend)
│   ├── auth/
│   │   ├── verification.ts         # Email/password token management
│   │   └── provider-invite.ts      # Provider invite token system
│   ├── constants.ts                # Business info, types, pricing
│   ├── validators.ts               # Zod validation schemas
│   ├── utils.ts                    # cn(), formatPrice()
│   ├── seo.ts                      # SEO config, keywords, metadata builder
│   ├── stripe.ts                   # Stripe SDK singleton
│   ├── geocoding.ts                # Google Maps geocoding wrapper
│   ├── distance.ts                 # Haversine distance calculation
│   ├── csv.ts                      # CSV generation + browser download
│   ├── hooks/
│   │   ├── use-websocket.ts        # WebSocket hook with auto-reconnect
│   │   ├── use-google-maps.ts      # Google Maps API loader hook
│   │   └── use-push-notifications.ts # Push notification hook
│   ├── notifications/
│   │   ├── index.ts                # Unified notification dispatcher
│   │   ├── email.ts                # Resend email notifications
│   │   ├── sms.ts                  # Twilio SMS notifications
│   │   └── push.ts                 # Web push notifications
│   └── receipts/
│       └── generate-receipt.ts     # HTML receipt generator
│
├── types/                          # TypeScript declarations
│   └── next-auth.d.ts              # NextAuth session type augmentation
│
├── public/                         # Static assets (6 files)
│   ├── sw.js                       # Service worker for push notifications
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── docs/                           # Generated documentation
│
├── package.json                    # Dependencies + scripts
├── tsconfig.json                   # TypeScript configuration
├── next.config.ts                  # Next.js config (standalone, external packages)
├── drizzle.config.ts               # Drizzle ORM config (PostgreSQL)
├── eslint.config.mjs               # ESLint configuration
├── postcss.config.mjs              # PostCSS + Tailwind
├── components.json                 # shadcn/ui config (New York style)
├── proxy.ts                        # NextAuth middleware (route protection)
├── server-custom.ts                # Custom server with WS support
├── docker-entrypoint.sh            # Container startup (migrations + server)
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml              # App + PostgreSQL services
├── .env.example                    # Environment variable template
├── .dockerignore                   # Docker build exclusions
└── .gitignore                      # Git exclusions
```

## Critical Folders Summary

| Folder | Purpose | File Count |
|---|---|---|
| `app/` | Next.js App Router pages and layouts | 47 |
| `components/` | Reusable React components | 59 |
| `server/api/` | Hono API backend (routes, middleware, lib) | 21 |
| `server/websocket/` | WebSocket real-time server | 4 |
| `db/schema/` | Drizzle ORM table definitions | 12 |
| `db/migrations/` | SQL migration files | 4 |
| `lib/` | Shared utilities, hooks, notifications | 19 |
| `public/` | Static assets and service worker | 6 |

## Entry Points

| Entry Point | File | Purpose |
|---|---|---|
| Next.js App | `app/layout.tsx` | Root layout with providers |
| API Server | `server/api/index.ts` | Hono app with all routes |
| API Mount | `app/api/[[...route]]/route.ts` | Catch-all route handler |
| WebSocket | `server/websocket/server.ts` | WS server setup |
| Custom Server | `server-custom.ts` | HTTP + WS upgrade |
| Auth | `lib/auth.ts` | NextAuth configuration |
| Database | `db/index.ts` | Drizzle connection |
| Middleware | `proxy.ts` | Route protection |
