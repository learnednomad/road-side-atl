# Deployment Guide - RoadSide ATL

> Generated: 2026-02-11 | Scan Level: Exhaustive

## Overview

The application is containerized with Docker using a multi-stage build. It runs as a standalone Next.js application with a custom Node.js server for WebSocket support. PostgreSQL 16 is used as the database.

## Docker Architecture

### Multi-Stage Build

| Stage | Base Image | Purpose |
|---|---|---|
| `deps` | node:20-alpine | Install all dependencies (including devDependencies) |
| `builder` | node:20-alpine | Build Next.js + compile custom server |
| `runner` | node:20-alpine | Production image with standalone output |

### Build Arguments (NEXT_PUBLIC_*)

These are baked into the build at compile time:

| Argument | Description |
|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client key |
| `NEXT_PUBLIC_CASHAPP_TAG` | CashApp payment tag |
| `NEXT_PUBLIC_ZELLE_INFO` | Zelle payment info |
| `NEXT_PUBLIC_BUSINESS_PHONE` | Business phone |
| `NEXT_PUBLIC_BUSINESS_NAME` | Business name |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps client key |

### Container Startup Flow (`docker-entrypoint.sh`)

```
1. Wait 3 seconds for database readiness
2. Create migration tracking schema if not exists
3. Seed prior migrations (backward compatibility)
4. Run pending database migrations
5. Start Node.js server (server.js from standalone output)
```

## Docker Compose

### Services

```yaml
services:
  app:     # Next.js application (port 3000)
  db:      # PostgreSQL 16 Alpine (port 5432)
```

### Database Configuration

| Setting | Value |
|---|---|
| Image | postgres:16-alpine |
| User | dealer |
| Password | dealer_pass |
| Database | roadside_atl |
| Volume | pgdata (persistent) |

### Health Check

| Setting | Value |
|---|---|
| Endpoint | `GET /api/services` |
| Interval | 30s |
| Timeout | 10s |
| Start Period | 60s |
| Retries | 3 |

## Deployment Commands

### Build and Run

```bash
# Build and start all services
docker compose up --build -d

# View logs
docker compose logs -f app

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v
```

### Database Operations

```bash
# Run migrations manually
docker compose exec app npx drizzle-kit migrate

# Seed data
docker compose exec app npx tsx db/seed.ts

# Open database studio
docker compose exec app npx drizzle-kit studio
```

## Environment Variables (Runtime)

These are set via Docker Compose environment or your hosting platform:

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth encryption key |
| `AUTH_TRUST_HOST` | Set to `true` for reverse proxy |
| `AUTH_URL` | Public application URL |

### Optional (Features)

| Variable | Description |
|---|---|
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe payments |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS |
| `RESEND_API_KEY` / `RESEND_FROM` | Email |
| `GOOGLE_MAPS_API_KEY_SERVER` | Server-side geocoding |
| `AUTO_DISPATCH_ENABLED` | Auto-dispatch (default: true) |
| `MAX_DISPATCH_DISTANCE_MILES` | Dispatch radius (default: 50) |
| `ADMIN_EMAIL` | Admin email for seeding |

## Production Considerations

### Next.js Standalone Output

The `next.config.ts` sets `output: "standalone"` which:
- Creates a minimal production build
- Includes only necessary node_modules
- Reduces Docker image size
- Outputs to `.next/standalone/`

### External Packages

```typescript
serverExternalPackages: ["postgres", "ws"]
```

These packages are excluded from the Next.js bundle and loaded at runtime (required for native modules).

### WebSocket Support

The custom server (`server-custom.ts`) handles HTTP/WS protocol upgrade. In production, the container runs `node server.js` (standalone output) which includes the Next.js handler.

### Security

- Non-root user (`nextjs:nodejs`) in Docker
- `AUTH_TRUST_HOST=true` required behind reverse proxy
- Rate limiting on auth endpoints (10 req/5min)
- Stripe webhook signature verification
- SMS rate limiting (1 per phone per 60s)

### Monitoring

- Health check endpoint: `GET /api/services`
- Audit log table tracks all critical operations
- WebSocket heartbeat (30s ping) detects stale connections

## CI/CD

No CI/CD pipeline is currently configured. No `.github/workflows/` or similar CI configuration files were found.

### Recommended Setup

1. Build Docker image on push to main
2. Run `npm run lint` as pre-build check
3. Deploy container to hosting platform
4. Migrations run automatically on container start
