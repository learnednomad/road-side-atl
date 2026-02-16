# Development Guide - RoadSide ATL

> Generated: 2026-02-11 | Scan Level: Exhaustive

## Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | 20.x | Runtime |
| npm | 10.x+ | Package manager |
| PostgreSQL | 16.x | Database (or via Docker) |
| Docker | Latest | Containerized development (optional) |

## Environment Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd road-side-atl
npm install
```

### 2. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

**Required variables:**

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/roadside_atl` |
| `AUTH_SECRET` | NextAuth session encryption key | Generate: `openssl rand -base64 32` |
| `AUTH_URL` | Application URL | `http://localhost:3000` |

**Optional variables (features degrade gracefully if not set):**

| Variable | Description |
|---|---|
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe payment processing |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client-side key |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps client-side |
| `GOOGLE_MAPS_API_KEY_SERVER` | Google Maps server-side (geocoding) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS notifications |
| `RESEND_API_KEY` / `RESEND_FROM` | Email notifications |
| `NEXT_PUBLIC_CASHAPP_TAG` | CashApp payment info |
| `NEXT_PUBLIC_ZELLE_INFO` | Zelle payment info |
| `NEXT_PUBLIC_BUSINESS_PHONE` | Business phone number |
| `NEXT_PUBLIC_BUSINESS_NAME` | Business display name |
| `AUTO_DISPATCH_ENABLED` | Enable auto-dispatch (default: true) |
| `MAX_DISPATCH_DISTANCE_MILES` | Auto-dispatch radius (default: 50) |
| `ADMIN_EMAIL` | Default admin email for seeding |

### 3. Database Setup

**Option A: Local PostgreSQL**

```bash
createdb roadside_atl
npm run db:push       # Push schema to database
npm run db:seed       # Seed demo data
```

**Option B: Docker**

```bash
docker compose up db  # Start PostgreSQL only
npm run db:push
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `next dev` | Start development server with hot reload |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | Run ESLint |
| `db:generate` | `drizzle-kit generate` | Generate migration from schema changes |
| `db:migrate` | `drizzle-kit migrate` | Run pending migrations |
| `db:push` | `drizzle-kit push` | Push schema directly (dev only) |
| `db:seed` | `tsx db/seed.ts` | Seed demo data |
| `db:studio` | `drizzle-kit studio` | Open Drizzle Studio (database GUI) |

## Database Workflow

### Schema Changes

1. Edit schema files in `db/schema/`
2. Generate migration: `npm run db:generate`
3. Review generated SQL in `db/migrations/`
4. Apply migration: `npm run db:migrate`

### Quick Schema Push (Development)

```bash
npm run db:push  # Pushes schema directly without migration files
```

### Database Studio

```bash
npm run db:studio  # Opens browser-based database GUI
```

## Demo Accounts (After Seeding)

| Role | Email | Password |
|---|---|---|
| Admin | admin@roadsideatl.com | admin123 |
| Admin | ops@roadsideatl.com | admin123 |
| Provider (Active) | marcus@roadsideatl.com | provider123 |
| Provider (Active) | terrence@roadsideatl.com | provider123 |
| Provider (Pending) | jamal@roadsideatl.com | provider123 |
| Customer | jasmine.carter@gmail.com | customer123 |
| Customer | david.okonkwo@gmail.com | customer123 |

## Project Structure

```
app/           → Next.js pages (route groups for role isolation)
components/    → React components (organized by feature)
server/        → Hono API + WebSocket server
db/            → Drizzle ORM schema + migrations + seed
lib/           → Shared utilities, hooks, notifications
types/         → TypeScript type augmentations
public/        → Static assets + service worker
```

## Key Patterns

### Adding a New API Route

1. Create route file in `server/api/routes/your-route.ts`
2. Import and register in `server/api/index.ts`
3. Add middleware (auth, rate limiting) as needed
4. Define Zod validation schemas in `lib/validators.ts`

### Adding a New Page

1. Create page in appropriate route group (`app/(marketing)/`, `app/(admin)/`, etc.)
2. Server components for data fetching, client components for interactivity
3. Add to navigation if needed (`components/admin/sidebar.tsx` or `components/marketing/navbar.tsx`)

### Adding a New Database Table

1. Create schema file in `db/schema/your-table.ts`
2. Export from `db/schema/index.ts`
3. Define relations in the schema file
4. Run `npm run db:generate` then `npm run db:migrate`

### Adding a New Component

1. Create in appropriate `components/` subdirectory
2. Use shadcn/ui primitives from `components/ui/`
3. Import via `@/components/...` path alias

## Path Aliases

| Alias | Path |
|---|---|
| `@/*` | Project root (`./`) |

Examples:
- `@/components/ui/button` → `./components/ui/button`
- `@/lib/utils` → `./lib/utils`
- `@/db` → `./db`
- `@/server/api` → `./server/api`

## Code Style

- **ESLint:** `eslint-config-next` with TypeScript
- **Formatting:** Default ESLint rules (no Prettier configured)
- **Components:** Functional components with named exports
- **Styling:** Tailwind CSS utility classes, `cn()` for conditional classes
- **Forms:** react-hook-form + Zod schemas
- **State:** Prefer server components; use client components only when needed for interactivity

## Common Development Tasks

### Test a Stripe webhook locally

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### View database contents

```bash
npm run db:studio
```

### Add a new shadcn/ui component

```bash
npx shadcn@latest add <component-name>
```

### Reset database

```bash
# Drop and recreate
dropdb roadside_atl && createdb roadside_atl
npm run db:push
npm run db:seed
```
