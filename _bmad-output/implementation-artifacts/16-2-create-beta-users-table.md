# Story 16.2: Create beta_users Table

Status: backlog

## Story

As a platform operator,
I want a `beta_users` table that tracks which users participated in the open beta,
so that we can measure beta adoption, track conversion post-beta, and identify beta participants for outreach.

## Acceptance Criteria

1. **Table Creation** - Given the database exists, when the migration runs, then a `beta_users` table is created with columns: `id` (text PK, cuid2), `userId` (text, FK to users, unique), `enrolledAt` (timestamp, default now), `source` (text, not null), `convertedAt` (timestamp, nullable).

2. **Unique Constraint** - Given a user is already enrolled in `beta_users`, when another insert for the same userId is attempted with `onConflictDoNothing()`, then the insert is silently skipped and no error is thrown.

3. **Foreign Key** - Given the `userId` column references the `users` table, when a user is deleted, then the corresponding `beta_users` row is cascade-deleted.

4. **Schema Export** - Given the new `beta-users.ts` schema file, when other modules import from `@/db/schema`, then `betaUsers` table and its types are available.

## Tasks / Subtasks

- [ ] Task 1: Create beta_users schema file (AC: #1, #2, #3)
  - [ ] 1.1 Create `db/schema/beta-users.ts` with the `betaUsers` pgTable definition
  - [ ] 1.2 Include `id` with `createId()`, `userId` with unique constraint and FK to `users.id` (onDelete: cascade), `enrolledAt` with `defaultNow()`, `source` (text, notNull), `convertedAt` (timestamp, nullable)
  - [ ] 1.3 Import `createId` from `@/db/schema/utils` (following existing pattern from `platform-settings.ts`)

- [ ] Task 2: Export from schema index (AC: #4)
  - [ ] 2.1 Add `export * from "./beta-users";` to `db/schema/index.ts`

- [ ] Task 3: Generate migration (AC: #1)
  - [ ] 3.1 Run `npm run db:generate` to produce Drizzle migration
  - [ ] 3.2 Verify the generated SQL creates the `beta_users` table with all columns and constraints

- [ ] Task 4: Verify idempotent insert (AC: #2)
  - [ ] 4.1 Run `npx tsc --noEmit` to verify TypeScript compiles cleanly
  - [ ] 4.2 Confirm the unique constraint on `userId` enables `onConflictDoNothing()` usage

## Dev Notes

### Critical Architecture Constraints

**Follow the existing schema file pattern.** Look at `db/schema/platform-settings.ts` for the canonical pattern — it uses `createId` from `@/db/schema/utils`, standard Drizzle column definitions, and a single exported table.

**`source` column tracks enrollment origin.** Expected values: `"booking"` (auto-enrolled on booking during beta), `"admin"` (manually enrolled by admin), `"signup"` (enrolled on account creation during beta). This is text, not an enum — keep it flexible for beta iteration.

**`convertedAt` is nullable.** It is set post-beta when a beta user becomes a paying customer. This column is NOT populated during beta — it is for post-beta conversion analysis.

### Existing Code You MUST Understand

**Schema file pattern** — `db/schema/platform-settings.ts`:
```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@/db/schema/utils";

export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Schema index** — `db/schema/index.ts` exports all schema files. Add the new export after the last line.

**Users table FK pattern** — Other tables reference `users.id` with cascade delete. Follow the same pattern:
```typescript
userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
```

### Exact Implementation Specifications

**`db/schema/beta-users.ts`:**
```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@/db/schema/utils";
import { users } from "./users";

export const betaUsers = pgTable("beta_users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  enrolledAt: timestamp("enrolledAt", { mode: "date" }).defaultNow().notNull(),
  source: text("source").notNull(), // "booking" | "admin" | "signup"
  convertedAt: timestamp("convertedAt", { mode: "date" }),
});
```

**`db/schema/index.ts` addition:**
```typescript
export * from "./beta-users";
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create an enum for `source` | Use text — values may change during beta |
| Add `updatedAt` to this table | Not needed — enrolledAt is immutable, convertedAt is set once |
| Add a `status` column | Not needed — enrolled vs. converted is sufficient |
| Create API routes in this story | Routes are Story 16.6 |
| Populate the table in this story | Seed data (if any) is Story 16.3, auto-enrollment is Story 16.6 |

### Dependencies and Scope

**This story blocks:** Story 16.3 (seed data references beta config), Story 16.6 (auto-enrollment + beta status endpoint)

**This story does NOT include:**
- Auto-enrollment logic on booking (Story 16.6)
- Beta status API endpoint (Story 16.6)
- Admin beta toggle (Story 16.7)
- Seed data (Story 16.3)

### Testing Guidance

No test framework is installed. Verify manually:
1. Run `npm run db:generate` — migration file produced
2. Run `npm run db:push` — table created
3. Insert a row — succeeds
4. Insert same `userId` again with `onConflictDoNothing()` — no error
5. `npx tsc --noEmit` compiles without errors

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 16, Story 16.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 3: Beta Mode via Platform Settings]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-2.4]
- [Source: db/schema/platform-settings.ts — Schema file pattern reference]
- [Source: db/schema/index.ts — Schema export index]
