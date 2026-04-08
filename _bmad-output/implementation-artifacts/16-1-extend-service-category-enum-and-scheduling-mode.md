# Story 16.1: Extend service_category Enum and Add schedulingMode Column

Status: backlog

## Story

As a platform developer,
I want to add `"mechanics"` to the service_category enum and a `schedulingMode` column to the services table,
so that the system can distinguish mechanic services from roadside/diagnostics and enforce scheduled-only booking for mechanic services.

## Acceptance Criteria

1. **Enum Extension** - Given the `serviceCategoryEnum` in `db/schema/services.ts` currently has `["roadside", "diagnostics"]`, when the migration runs, then `"mechanics"` is added as a valid enum value, and existing service rows with `"roadside"` or `"diagnostics"` are unaffected.

2. **schedulingMode Column** - Given the services table exists, when the migration runs, then a `schedulingMode` text column is added with default `"both"`, and all existing services receive the default value `"both"`.

3. **Migration Integrity** - Given the schema changes are made, when `npm run db:generate` is run, then a valid migration SQL file is produced containing `ALTER TYPE service_category ADD VALUE 'mechanics'` and an `ALTER TABLE` for the new column, and the migration applies without errors.

4. **Schema Export** - Given the updated services schema, when other modules import from `@/db/schema`, then the updated `serviceCategoryEnum` and `services` table (with `schedulingMode`) are available.

## Tasks / Subtasks

- [ ] Task 1: Extend service_category enum (AC: #1)
  - [ ] 1.1 Add `"mechanics"` to the `serviceCategoryEnum` array in `db/schema/services.ts` — change `["roadside", "diagnostics"]` to `["roadside", "diagnostics", "mechanics"]`

- [ ] Task 2: Add schedulingMode column (AC: #2)
  - [ ] 2.1 Add `schedulingMode` text column to the `services` pgTable definition: `schedulingMode: text("schedulingMode").default("both").notNull()`
  - [ ] 2.2 Place it after the `category` column for logical grouping

- [ ] Task 3: Generate migration (AC: #3)
  - [ ] 3.1 Run `npm run db:generate` to produce Drizzle migration
  - [ ] 3.2 Verify the generated SQL contains `ALTER TYPE service_category ADD VALUE 'mechanics'`
  - [ ] 3.3 Verify the generated SQL adds the `schedulingMode` column with default `'both'`

- [ ] Task 4: Verify exports (AC: #4)
  - [ ] 4.1 Confirm `db/schema/index.ts` already re-exports `./services` (it does — no changes needed)
  - [ ] 4.2 Run `npx tsc --noEmit` to verify TypeScript compiles cleanly

## Dev Notes

### Critical Architecture Constraints

**This is a brownfield project.** The enum extension must be non-destructive — `ALTER TYPE ... ADD VALUE` does not affect existing rows.

**schedulingMode is text, NOT an enum.** Architecture Decision 2 explicitly chose text over a Postgres enum because the value set (`"immediate"` | `"scheduled"` | `"both"`) may expand. Validation is done at the application layer via Zod, not at the DB level.

**No application code changes in this story.** This story is schema-only. The `?category=` filter (Story 16.5), booking validation (Epic 17), and seed data (Story 16.3) are separate stories.

### Existing Code You MUST Understand

**Current serviceCategoryEnum** — `db/schema/services.ts` (lines 12-15):
```typescript
export const serviceCategoryEnum = pgEnum("service_category", [
  "roadside",
  "diagnostics",
]);
```

**Current services table** — `db/schema/services.ts` (lines 17-34):
```typescript
export const services = pgTable("services", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  basePrice: integer("basePrice").notNull(), // cents
  pricePerMile: integer("pricePerMile"), // cents, nullable
  category: serviceCategoryEnum("category").notNull(),
  active: boolean("active").default(true).notNull(),
  checklistConfig: jsonb("checklistConfig").$type<{ category: string; items: string[] }[]>(),
  commissionRate: integer("commissionRate").notNull().default(2500), // basis points
  stripeProductId: text("stripeProductId"),
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Schema index** — `db/schema/index.ts` already exports `./services` (line 2). No changes needed.

### Exact Implementation Specifications

**1. Enum change** (`db/schema/services.ts` line 13):
Change:
```typescript
export const serviceCategoryEnum = pgEnum("service_category", [
  "roadside",
  "diagnostics",
]);
```
To:
```typescript
export const serviceCategoryEnum = pgEnum("service_category", [
  "roadside",
  "diagnostics",
  "mechanics",
]);
```

**2. New column** (`db/schema/services.ts`):
Add after the `category` line (line 26):
```typescript
schedulingMode: text("schedulingMode").default("both").notNull(),
```

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Create a new enum for schedulingMode | Use text column with Zod validation |
| Add Zod validators in this story | Validators are added in Story 16.5 or Epic 17 |
| Modify seed data | Seed data is Story 16.3 |
| Modify route handlers | Route changes are Story 16.5 |
| Create a new schema file | Modify existing `db/schema/services.ts` |

### Dependencies and Scope

**This story blocks:** Story 16.3 (seed data), Story 16.5 (category filter API), Story 17.1 (scheduledAt enforcement)

**This story does NOT include:**
- Seed data for mechanic services (Story 16.3)
- Category filter on services API (Story 16.5)
- Booking validation for scheduledAt (Story 17.1)
- beta_users table (Story 16.2)

### Testing Guidance

No test framework is installed. Verify manually:
1. Run `npm run db:generate` — migration file produced
2. Run `npm run db:push` — migration applies cleanly
3. Query existing services — all have `schedulingMode = 'both'`
4. `npx tsc --noEmit` compiles without errors

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 16, Story 16.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 1: Service Category Enum Extension]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 2: Scheduling Mode Column]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-1.1, FR-1.2]
- [Source: db/schema/services.ts — Existing services table and enum definition]
