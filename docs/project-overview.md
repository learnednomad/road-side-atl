# Project Overview - RoadSide ATL

> Generated: 2026-02-11 | Scan Level: Exhaustive

## Purpose

RoadSide ATL is a 24/7 roadside assistance platform serving the Atlanta metro area. It connects customers experiencing vehicle emergencies (flat tires, dead batteries, lockouts, towing needs) with local service providers. The platform handles the full lifecycle: booking, dispatch, real-time tracking, payment processing, and provider management.

## Quick Reference

| Property | Value |
|---|---|
| **Project Name** | road-side-atl |
| **Version** | 0.1.0 |
| **Repository Type** | Monolith |
| **Primary Language** | TypeScript |
| **Framework** | Next.js 16.1.6 (App Router) |
| **API Framework** | Hono 4.11.7 |
| **Database** | PostgreSQL 16 via Drizzle ORM |
| **Authentication** | NextAuth.js v5 (JWT sessions) |
| **UI** | Tailwind CSS v4 + shadcn/ui (Radix) |
| **Real-time** | WebSocket (ws) |
| **Deployment** | Docker (standalone) |

## Service Offerings

| Service | Base Price | Category |
|---|---|---|
| Jump Start | $100 | Roadside |
| Towing (Local) | $125 + $3/mile | Roadside |
| Lockout Service | $135 | Roadside |
| Flat Tire Change | $100 | Roadside |
| Fuel Delivery | $75 | Roadside |
| Car Purchase Diagnostics | $250 | Diagnostics |

## User Roles

| Role | Access | Key Features |
|---|---|---|
| **Customer** | Public pages + booking + tracking | Book services, track in real-time, view history, leave reviews |
| **Provider** | Provider portal | Accept/reject jobs, update status, GPS tracking, view earnings |
| **Admin** | Admin panel | Manage bookings, providers, payouts, revenue analytics, audit logs |

## Payment Methods

- **Cash** — Pay provider directly, admin confirms
- **CashApp** — Send to business tag, admin confirms
- **Zelle** — Send to business email, admin confirms
- **Stripe** — Online checkout (auto-confirmed via webhook)

## Integration Points

| Integration | Purpose | Provider |
|---|---|---|
| Google Maps | Address autocomplete, geocoding, live tracking | Google Cloud |
| Stripe | Online payment processing | Stripe |
| Twilio | SMS notifications | Twilio |
| Resend | Email notifications | Resend |
| Web Push | Browser push notifications | VAPID |

## Key Statistics

| Metric | Count |
|---|---|
| Source Files | ~200 |
| App Routes | 47 |
| React Components | 59 |
| API Endpoints | 70+ |
| Database Tables | 14 |
| Database Enums | 10 |
| Library Files | 19 |
| Server Files | 25 |

## Architecture Summary

The application follows a **layered monolith** pattern with role-based route groups:

1. **Client Layer** — Next.js App Router with 5 route groups (marketing, auth, admin, provider, dashboard)
2. **Component Layer** — 59 React components organized by feature domain
3. **API Layer** — Hono REST API with 15 route modules, auth middleware, rate limiting
4. **Real-time Layer** — WebSocket server for live tracking, status updates, job notifications
5. **Data Layer** — Drizzle ORM with 14 PostgreSQL tables, schema-first approach
6. **Infrastructure** — Docker containerization with PostgreSQL, automated migrations

## Documentation Index

- [Architecture](./architecture.md) — System design, patterns, and decisions
- [API Contracts](./api-contracts.md) — All 70+ API endpoints with schemas
- [Data Models](./data-models.md) — Database schema, relationships, seed data
- [Source Tree](./source-tree-analysis.md) — Annotated directory structure
- [Component Inventory](./component-inventory.md) — All 59 React components
- [Development Guide](./development-guide.md) — Setup, scripts, patterns
- [Deployment Guide](./deployment-guide.md) — Docker, environment, production
