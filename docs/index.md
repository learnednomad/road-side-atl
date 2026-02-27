# RoadSide ATL - Project Documentation Index

> Generated: 2026-02-11 | Mode: Initial Scan | Scan Level: Exhaustive

## Project Overview

- **Type:** Monolith
- **Primary Language:** TypeScript
- **Framework:** Next.js 16.1.6 (App Router) + Hono 4.11.7
- **Database:** PostgreSQL 16 via Drizzle ORM
- **Architecture:** Layered monolith with role-based route groups

## Quick Reference

- **Tech Stack:** Next.js 16 + React 19 + Hono + Drizzle ORM + PostgreSQL 16 + Tailwind CSS 4 + shadcn/ui
- **Entry Point:** `app/layout.tsx` (UI) / `server/api/index.ts` (API) / `server-custom.ts` (Server)
- **Architecture Pattern:** Layered monolith — Route Groups (admin/auth/marketing/provider) + Hono REST API + WebSocket
- **Auth:** NextAuth.js v5 (JWT sessions) — Google, Credentials, Resend providers
- **Payments:** Stripe + Cash + CashApp + Zelle
- **Real-time:** WebSocket for live tracking, status updates, job notifications
- **Notifications:** Email (Resend) + SMS (Twilio) + Web Push (VAPID)
- **Maps:** Google Maps (Places autocomplete, Geocoding, AdvancedMarker)

## Feature Documentation

- [Technical Feature Catalog](./feature-catalog-technical.md) — Complete inventory of all platform features with schemas, APIs, business logic, and file paths (developer audience)
- [User Feature Guide](./feature-guide-users.md) — Task-oriented guide to all features for customers, providers, and administrators (end-user audience)
- [Architecture Diagrams](./architecture-diagram.md) — Full system architecture, feature connection map, and booking lifecycle sequence diagram (Mermaid)

## Generated Documentation

- [Project Overview](./project-overview.md) — Purpose, services, roles, integrations
- [Architecture](./architecture.md) — System design, patterns, key decisions
- [API Contracts](./api-contracts.md) — All 70+ API endpoints with request/response schemas
- [Data Models](./data-models.md) — 14 database tables, relationships, enums, seed data
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory structure with 200+ files
- [Component Inventory](./component-inventory.md) — 59 React components organized by domain
- [Development Guide](./development-guide.md) — Setup, scripts, patterns, demo accounts
- [Deployment Guide](./deployment-guide.md) — Docker, environment, production considerations

## Existing Documentation

- [README.md](../README.md) — Default Next.js README (not customized)
- [SEO-STRATEGY.md](../SEO-STRATEGY.md) — SEO strategy for Atlanta market targeting

## Getting Started

### For Development

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in required variables
3. Start database: `docker compose up db -d`
4. Push schema: `npm run db:push`
5. Seed demo data: `npm run db:seed`
6. Start dev server: `npm run dev`
7. Open [http://localhost:3000](http://localhost:3000)

### Demo Accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Admin | admin@roadsideatl.com | admin123 |
| Provider | marcus@roadsideatl.com | provider123 |
| Customer | jasmine.carter@gmail.com | customer123 |

### For Production

```bash
docker compose up --build -d
```

See [Deployment Guide](./deployment-guide.md) for full details.
