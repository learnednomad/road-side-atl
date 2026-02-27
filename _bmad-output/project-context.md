---
project_name: 'road-side-atl'
user_name: 'Beel'
date: '2026-02-11'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 127
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Stack
- **Runtime**: Node.js 20 (Alpine)
- **Framework**: Next.js 16.1.6 (App Router, `output: "standalone"`)
- **Language**: TypeScript ^5 (strict mode, target ES2017, bundler moduleResolution)
- **React**: 19.2.3 (React 19 - Server Components default, `"use client"` required for client components)

### API Layer
- **Hono** ^4.11.7 - ALL API routes go through Hono, NOT Next.js Route Handlers
  - Catch-all at `app/api/[[...route]]/route.ts` delegates to `server/api/`
  - New endpoints: create in `server/api/routes/`, register in `server/api/index.ts`

### Database
- **Drizzle ORM** ^0.45.1 with **drizzle-kit** ^0.31.8
- **PostgreSQL 16** via `postgres` package (postgres.js) - NOT `pg`
- Both query styles used: relational (`db.query.table.findFirst()`) and SQL-like (`db.select().from()`)

### Auth
- **NextAuth v5** (^5.0.0-beta.30) - BETA, NOT v4
  - Use `auth()` function, NOT `getServerSession()`
  - Config split: `lib/auth.ts` (main) + `lib/auth.config.ts` (Edge-safe config)
  - JWT strategy with Drizzle adapter
  - Providers: Credentials + Google + optional Resend (magic link)

### Validation
- **Zod ^4.3.6** - MUST import from `zod/v4`: `import { z } from "zod/v4"`
  - NOT `import { z } from "zod"` (that's Zod v3 syntax)

### Styling & UI
- **Tailwind CSS v4** - CSS-based config via `@import "tailwindcss"`, NO `tailwind.config.js`
- **shadcn/ui** (CLI tool only, components in `components/ui/`)
- **Radix UI** ^1.4.3 (headless primitives)
- **tw-animate-css** ^1.4.0 (NOT `tailwindcss-animate` from v3)
- **PostCSS**: `@tailwindcss/postcss` plugin (v4-specific)

### Payments & Notifications
- **Stripe** ^20.3.0, **Twilio** ^5.12.0 (SMS), **Resend** ^6.9.1 (email)
- **web-push** ^3.6.7 (push notifications)

### Real-time & Maps
- **ws** ^8.19.0 (custom WebSocket server in `server/websocket/`)
- **@googlemaps/js-api-loader** ^2.0.2

### Forms & Charts
- **react-hook-form** ^7.71.1 with **@hookform/resolvers** ^5.2.2
- **Recharts** ^3.7.0

### Testing
- **No test framework currently installed** - do not assume Jest/Vitest/Playwright exist

### Deployment
- Docker multi-stage build (deps -> builder -> runner), Coolify-compatible
- `serverExternalPackages: ["postgres", "ws"]` in next.config.ts

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

#### Imports & Modules
- **Path alias**: always use `@/` imports (maps to project root), never relative `../`
- **Zod v4**: `import { z } from "zod/v4"` - NEVER `from "zod"` (that's v3)
- **Type-only imports**: use `import type` for types that aren't used at runtime (e.g., `import type { NextConfig } from "next"`)
- **Barrel exports**: schema modules re-export via `db/schema/index.ts` - import from `@/db/schema`

#### Type Patterns
- **Constants → types**: define `as const` arrays, derive types: `type X = (typeof ARRAY)[number]`
- **Zod inference**: `z.infer<typeof schema>` for form/API input types
- **JSONB typing**: use `.$type<T>()` on Drizzle JSONB columns
- **Inline prop types**: type component props inline `({ prop }: { prop: Type })`, NOT separate `interface Props`
- **Type assertions allowed when**: casting env vars, post-auth session data, JSONB column values, `as const` literals
- **Non-null `!` allowed for**: `process.env.REQUIRED_VAR!`, post-middleware user access, known-present query results
- **Co-locate types**: keep types next to their usage, no centralized types files

#### Naming Conventions
- **Files**: `kebab-case.ts` / `kebab-case.tsx`; client components: `*-client.tsx`
- **Functions**: camelCase; components: PascalCase
- **Handlers**: `handle*` for events, `on*` for callback props
- **Utilities**: `create*` (factories), `send*` (notifications), `notify*` (fire-and-forget), `broadcast*` (WebSocket)
- **Booleans**: prefix with `is*` or `has*`
- **Constants**: `SCREAMING_SNAKE_CASE` for enum arrays, PascalCase for config objects
- **DB tables**: plural lowercase; columns: camelCase; Drizzle enums: `*Enum` suffix

#### IDs & Money
- **IDs**: text-based UUIDs via `crypto.randomUUID()` - not auto-increment, not pg `uuid` type
- **Money**: always integers in cents. Display via `formatPrice(cents)` from `lib/utils.ts`

#### Error Handling
- **NO try-catch in route handlers** - Hono handles uncaught errors. Only use try-catch for: Stripe webhook signatures, dynamic imports with fallbacks
- **Validation**: `safeParse(body)` -> check `success` -> return 400 with `{ error: "Invalid input", details: parsed.error.issues }`
- **Not found**: `return c.json({ error: "X not found" }, 404)`
- **Auth errors**: handled by middleware, not route handlers
- **Fire-and-forget**: `.catch(() => {})` for notifications/broadcasts; `.catch(() => null)` when result feeds into next operation

#### Drizzle ORM Patterns
- **Simple lookups**: use `db.query.table.findFirst({ where: ... })`
- **Joins/aggregations**: use `db.select().from().innerJoin()` query builder
- **Insert/Update**: ALWAYS destructure `.returning()`: `const [result] = await db.insert(...).returning()`
- **Manual updatedAt**: ALWAYS include `updatedAt: new Date()` in every `.update().set()` call - no auto-trigger
- **Dynamic queries**: use `.$dynamic()` for conditional where clauses

#### Environment Variables
- **Required vars**: use `!` assertion (`process.env.DATABASE_URL!`) - crash is correct
- **Optional services**: check existence first, gracefully degrade (`if (!process.env.TWILIO_ACCOUNT_SID) return null`)
- **Feature flags**: string comparison (`process.env.AUTO_DISPATCH_ENABLED !== "true"`)
- **Client-side**: must use `NEXT_PUBLIC_*` prefix

### Framework-Specific Rules

#### Next.js App Router
- **Route groups**: `(marketing)`, `(admin)`, `(provider)`, `(dashboard)`, `(auth)` - each has its own `layout.tsx`
- **Server Components are default** - only add `"use client"` when using hooks, event handlers, or browser APIs
- **Client component files**: name with `*-client.tsx` suffix (e.g., `overview-client.tsx`)
- **Page data fetching**: fetch in Server Components or server-side in `page.tsx`, pass as props to client components
- **No `use server` actions used** - all mutations go through Hono API routes
- **Standalone output**: `next.config.ts` sets `output: "standalone"` for Docker
- **External packages**: `serverExternalPackages: ["postgres", "ws"]` - these skip Next.js bundling

#### Hono API Layer
- **All API routes**: create in `server/api/routes/`, NOT in `app/api/`
- **Route registration**: add new routes in `server/api/index.ts` with `app.route("/path", routeModule)`
- **Route pattern**: `const app = new Hono()` -> define handlers -> `export default app`
- **Request body**: `const body = await c.req.json()`
- **URL params**: `const id = c.req.param("id")`
- **Query params**: `const search = c.req.query("search")`
- **Responses**: `return c.json(data, statusCode)` - always return, always include status
- **Auth middleware**: apply `requireAuth`, `requireAdmin`, or `requireProvider` per-route or with `app.use("/*", middleware)`
- **User access**: after auth middleware, use `const user = c.get("user")` to get `{ id, role, name, email }`
- **Rate limiting**: apply `rateLimitStrict` middleware on abuse-prone endpoints (e.g., booking creation)
- **Audit logging**: use `logAudit()` from `server/lib/audit-logger` for state-changing operations

#### React Patterns
- **State**: `useState` for local state, no global state library
- **Data fetching**: `useEffect` + `fetch` to Hono API routes, set loading/error/data states
- **Forms**: `react-hook-form` with Zod resolvers from `@hookform/resolvers`
- **Navigation**: `useRouter()` from `next/navigation` (NOT `next/router`)
- **Custom hooks**: `lib/hooks/` - `useWebSocket`, `usePushNotifications`, `useGoogleMaps`
- **Toast notifications**: `sonner` via `<Toaster />` in root layout - use `toast.success()`, `toast.error()`
- **UI components**: use shadcn/ui from `@/components/ui/` - do NOT create custom primitives

#### WebSocket Integration
- **Server**: custom ws server in `server/websocket/` with connection tracking and broadcast
- **Client hook**: `useWebSocket(userId, role)` from `lib/hooks/use-websocket.ts`
- **Broadcast functions**: `broadcastToAdmins()`, `broadcastToUser()` from `server/websocket/broadcast.ts`
- **Message types**: typed as `{ type: "event:action", data: { ... } }` (e.g., `booking:created`)

### Testing Rules

#### Current State
- **No test framework installed** - do not generate test files unless explicitly asked
- **Implicit test coverage exists**: TypeScript strict mode + Zod schema validation serve as the primary safety net
- **Do NOT auto-generate** `__tests__/`, `*.test.ts`, or `*.spec.ts` files alongside feature code

#### If Adding Tests
- **Framework**: use **Vitest** (NOT Jest) - project uses ESM, Jest has poor ESM support
- **E2E**: use **Playwright** if browser testing needed
- **API route testing**: use Hono's `app.request()` test helper or plain `fetch`, NOT Next.js test utilities
- **Test fixtures**: adapt patterns from `db/seed.ts` (30K+ of realistic seed data) - don't reinvent data factories
- **WebSocket testing**: separate concern from HTTP routes - `server/websocket/` runs as its own process

#### Testing Pyramid (Priority Order)
1. **Unit**: Zod schema edge cases, utility functions (`lib/distance.ts`, `lib/csv.ts`, `formatPrice`)
2. **Integration**: Hono route handlers (request → validation → DB → response flow)
3. **E2E**: Critical user flows only (booking, admin actions, provider portal)

#### Do NOT Test
- shadcn/ui components (third-party, no value in snapshot tests)
- NextAuth internals (black box - test at integration level only)
- Hono middleware in isolation (test via route integration tests)
- React component rendering in isolation (low value for this project)

### Code Quality & Style Rules

#### Linting & Formatting
- **ESLint**: flat config (`eslint.config.mjs`) with `eslint-config-next` core-web-vitals + TypeScript
- **No Prettier** - no pre-commit hooks (no husky/lint-staged)
- **Semicolons**: use semicolons in all hand-written code; `components/ui/` omits them (shadcn-generated, leave as-is)
- **Quotes**: double quotes for imports and strings
- **Trailing commas**: used in multi-line objects and arrays

#### File & Folder Structure
- `app/` - Next.js pages, layouts, route groups (no business logic)
- `server/api/routes/` - Hono API route handlers (one per resource)
- `server/api/middleware/` - Hono middleware (auth, rate-limit)
- `server/api/lib/` - server-side utilities (audit-logger, auto-dispatch, payout-calculator)
- `server/websocket/` - WebSocket server (connections, broadcast, types)
- `lib/` - shared utilities, auth config, validators, constants, hooks, notifications
- `lib/hooks/` - custom React hooks
- `lib/notifications/` - one file per notification channel
- `components/` - domain-based organization matching route groups (admin, booking, provider, marketing, maps, reviews, dashboard)
- `components/ui/` - shadcn/ui primitives ONLY - never put custom components here
- `components/providers/` - React context providers (session, websocket)
- `db/schema/` - one Drizzle schema file per entity
- `db/migrations/` - drizzle-kit generated (never hand-edit)
- `types/` - TypeScript declaration overrides only (e.g., `next-auth.d.ts`)

#### Export Patterns
- **Named exports** for all components: `export function ComponentName` - NOT `export default`
- **Default exports ONLY for**: Hono route modules (`export default app`), Next.js pages, config files
- **No barrel exports** except `db/schema/index.ts` - import directly from source files

#### Minimal Ceremony Philosophy
- **No inline comments or JSDoc** - code is self-documenting. Only comment if logic is truly non-obvious
- **No README files** for subdirectories
- **No per-feature `types.ts`** - co-locate types or use inline typing
- **No per-feature `constants.ts`** - use central `lib/constants.ts`
- **No wrapper abstractions** - no creating helper layers around existing libraries
- **`lib/utils.ts`** is for universal tiny utilities only (`cn`, `formatPrice`) - domain utils get own files in `lib/`

#### Tailwind & Theming
- **`cn()` utility**: always use for conditional classes - never string concatenation
- **Colors**: use Tailwind utility classes or CSS variables (`var(--primary)`) - never raw hex/hsl/rgb
- **Color space**: theme uses `oklch` in `globals.css` - maintain consistency
- **Tailwind v4 `@theme inline`**: all theme tokens defined in CSS, not a JS config file

### Development Workflow Rules

#### Git & Repository
- **Main branch**: `main`
- **Commit style**: imperative present tense (e.g., "Add provider self-registration", "Fix healthcheck")
- **No branch naming convention enforced** - feature branches merged via PRs

#### Database Workflow
- **Schema changes**: edit files in `db/schema/`, then run `npm run db:generate` to create migration
- **Apply migrations**: `npm run db:migrate` (uses drizzle-kit)
- **Push schema directly** (dev): `npm run db:push` (skips migration files)
- **Seed data**: `npm run db:seed` (runs `db/seed.ts` via tsx)
- **Never hand-edit** files in `db/migrations/`

#### Deployment
- **Docker**: multi-stage Dockerfile (deps → builder → runner), Coolify-hosted
- **Build-time env vars**: `NEXT_PUBLIC_*` are baked in at build time via Docker ARGs
- **Runtime env vars**: all others injected via docker-compose environment
- **Dummy DATABASE_URL** at build time so Drizzle schema imports don't crash
- **Entrypoint**: `docker-entrypoint.sh` handles migrations + app start
- **Health check**: `wget` to `http://127.0.0.1:3000/api/services` (use IPv4, not `localhost`)

#### Adding New Features Checklist
1. **New API endpoint**: create `server/api/routes/feature.ts` → register in `server/api/index.ts`
2. **New DB entity**: create `db/schema/entity.ts` → add `export * from "./entity"` to `db/schema/index.ts` → run `db:generate`
3. **New page**: create `app/(route-group)/path/page.tsx` in the correct route group
4. **New component**: add to `components/domain/` matching the route group
5. **New validator**: add Zod schema to `lib/validators.ts`
6. **New constant/enum**: add to `lib/constants.ts`

### Critical Don't-Miss Rules

#### Anti-Patterns to Avoid
- **NEVER create API routes in `app/api/`** - all routes go through Hono in `server/api/routes/`
- **NEVER use `import { z } from "zod"`** - must be `from "zod/v4"`
- **NEVER use `getServerSession()`** - this is NextAuth v5, use `auth()` from `lib/auth`
- **NEVER use `next/router`** - use `next/navigation` (App Router)
- **NEVER wrap route handlers in try-catch** - Hono handles uncaught errors
- **NEVER create `tailwind.config.js`** - Tailwind v4 uses CSS-based config
- **NEVER use `pg` package patterns** - database uses `postgres` (postgres.js)
- **NEVER forget `updatedAt: new Date()`** in Drizzle `.update().set()` calls
- **NEVER forget to destructure `.returning()`** - it returns an array: `const [result] = ...`
- **NEVER add default exports to components** - use named exports
- **NEVER instantiate a new DB client** - always import `db` from `@/db` (singleton)
- **NEVER add `.references()` to `providerId` on bookings** - it's intentionally unlinked to avoid circular imports
- **NEVER import Next.js modules in `server/websocket/`** - WebSocket server runs outside Next.js
- **NEVER call `c.req.json()` in GET handlers** - it throws on empty body
- **NEVER use `eq(column, null)`** for null checks - use `isNull(column)` from drizzle-orm
- **NEVER import `@react-pdf/renderer` in client components** - Node.js only, crashes the build
- **NEVER move DB queries into `lib/auth.config.ts`** - must be Edge-compatible, no Node.js APIs

#### Security Rules
- **Auth middleware is mandatory** for protected routes - use `requireAuth`, `requireAdmin`, or `requireProvider`
- **Zod validation on all inputs** - never trust raw `c.req.json()` data
- **Rate limiting** on public endpoints (booking creation, registration)
- **Audit logging** for state-changing admin operations via `logAudit()`
- **Environment secrets** never exposed to client - only `NEXT_PUBLIC_*` vars are client-safe
- **Password hashing**: bcryptjs - never store plain text passwords

#### Business Logic Gotchas
- **Prices in cents** - all `estimatedPrice`, `finalPrice`, `amount` fields are integers in cents
- **Towing pricing**: base price + $6/mile after first 10 miles (`TOWING_BASE_MILES`, `TOWING_PRICE_PER_MILE_CENTS`)
- **Booking can be guest or authenticated** - `userId` is nullable on bookings
- **Provider assignment** is app-level, not a DB foreign key (avoids circular imports)
- **Auto-dispatch** is feature-flagged via `AUTO_DISPATCH_ENABLED` env var
- **Three user roles**: `customer`, `admin`, `provider` - check `user.role` from middleware context

#### API & Routing Gotchas
- **Hono basePath is `/api`** - all sub-routes are relative. Frontend fetches must use `/api/path`, not `/path`
- **Notifications are fire-and-forget** - they silently no-op when env vars are missing (graceful degradation in dev)
- **`broadcastToAdmins`/`broadcastToUser`** - never await, never add error handling around them
- **Docker entrypoint auto-runs migrations** - destructive schema changes apply automatically on deploy

#### Package Version Traps
- **date-fns v4** - verify API compatibility, some subpath imports changed from v3
- **NextAuth v5 beta** - API differs significantly from v4 docs/examples
- **Zod v4** - different import path and some API changes from v3
- **Tailwind v4** - completely different config system from v3

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-02-11
