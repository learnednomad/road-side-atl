# Story 16.3: Seed Mechanic Services and Beta Config

Status: backlog

## Story

As a platform developer,
I want the seed script to insert 6 mechanic services and 3 beta configuration rows into platform_settings,
so that the development and staging environments have mechanic services available and beta mode is active by default.

## Acceptance Criteria

1. **Mechanic Services Seeded** - Given the seed script runs, when the services table is queried, then 6 new mechanic services exist with correct slugs (`oil-change`, `brake-service`, `battery-replace`, `general-maintenance`, `ac-repair`, `belt-replacement`), all with `category: "mechanics"`, `schedulingMode: "scheduled"`, and `commissionRate: 2500`.

2. **Prices Correct** - Given the seeded mechanic services, when queried, then prices match the PRD catalog: oil-change=7500, brake-service=15000, battery-replace=12000, general-maintenance=9500, ac-repair=13000, belt-replacement=11000 (all in cents).

3. **Checklist Configs** - Given each mechanic service, when the `checklistConfig` JSONB is read, then each service has a relevant checklist with service-specific inspection items.

4. **Beta Config Rows** - Given the seed script runs, when `platform_settings` is queried, then rows exist for `beta_mode_active` (value: `"true"`), `beta_start_date` (value: `"2026-04-07"`), `beta_end_date` (value: `"2026-06-07"`).

5. **Idempotent Seed** - Given the seed script clears data before inserting, when run multiple times, then no duplicate services or settings are created and no errors occur.

## Tasks / Subtasks

- [ ] Task 1: Add mechanic services to seed (AC: #1, #2, #3)
  - [ ] 1.1 Add 6 mechanic service objects to the `services` insert array in `db/seed.ts`
  - [ ] 1.2 Each service: `category: "mechanics"`, `schedulingMode: "scheduled"`, `commissionRate: 2500`
  - [ ] 1.3 Add `checklistConfig` JSONB for each service with relevant inspection items
  - [ ] 1.4 Destructure the returned values to capture mechanic service references (for potential booking seed data)

- [ ] Task 2: Add beta config to seed (AC: #4)
  - [ ] 2.1 Import `platformSettings` from `@/db/schema`
  - [ ] 2.2 Add `db.delete(platformSettings)` to the cleanup section (before services cleanup)
  - [ ] 2.3 Insert 3 `platform_settings` rows: `beta_mode_active`, `beta_start_date`, `beta_end_date`

- [ ] Task 3: Verify seed idempotency (AC: #5)
  - [ ] 3.1 Ensure `platformSettings` is deleted in the cleanup phase
  - [ ] 3.2 Run `npx tsc --noEmit` to verify TypeScript compiles

## Dev Notes

### Critical Architecture Constraints

**All prices in cents (integer).** The PRD lists prices as dollars — convert: $75 = 7500, $150 = 15000, etc. Never use floats.

**Commission in basis points.** All mechanic services use 2500 bp (25%) — same as existing services.

**`schedulingMode: "scheduled"`** for all mechanic services. Existing roadside/diagnostics services keep their default `"both"`.

**Beta config uses `platform_settings` key-value pattern.** Values are always strings. Dates stored as ISO date strings (`"2026-04-07"`).

### Existing Code You MUST Understand

**Seed file service insert pattern** — `db/seed.ts` (lines 47-61):
```typescript
// ── SERVICES ──────────────────────────────────────────────
console.log("Seeding services...");
const [svcJump, svcTow, svcLockout, svcTire, svcFuel, , svcDiagStandard, ] = await db
  .insert(services)
  .values([
    {
      name: "Jump Start",
      slug: "jump-start",
      description: "Dead battery? We'll get you running again...",
      basePrice: 10000,
      category: "roadside",
      commissionRate: 2500,
      checklistConfig: [{ category: "Jump Start", items: ["Battery Voltage", "Terminal Condition", "Alternator Output", "Cable Integrity"] }],
    },
    // ... more services
  ])
  .returning();
```

**Platform settings table** — `db/schema/platform-settings.ts`:
```typescript
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});
```

**Cleanup pattern** — The seed script deletes in dependency order before inserting. `platformSettings` needs to be added to the cleanup section.

### Exact Implementation Specifications

**1. Mechanic services to add (append to existing services `.values([...])` array):**

```typescript
// Mechanic services (all scheduled-only)
{
  name: "Oil Change",
  slug: "oil-change",
  description: "Professional on-site oil change at your location. Includes conventional oil and standard filter.",
  basePrice: 7500,
  category: "mechanics",
  schedulingMode: "scheduled",
  commissionRate: 2500,
  checklistConfig: [{ category: "Oil Change", items: ["Oil Level", "Oil Filter", "Drain Plug", "Oil Type Verified", "Dipstick Reading"] }],
},
{
  name: "Brake Pad Replacement",
  slug: "brake-service",
  description: "Mobile brake pad replacement service. Standard brake pads included.",
  basePrice: 15000,
  category: "mechanics",
  schedulingMode: "scheduled",
  commissionRate: 2500,
  checklistConfig: [{ category: "Brake Service", items: ["Pad Thickness", "Rotor Condition", "Brake Fluid Level", "Caliper Function", "Brake Line Integrity"] }],
},
{
  name: "Battery Replacement",
  slug: "battery-replace",
  description: "On-site battery replacement. Standard battery included in service price.",
  basePrice: 12000,
  category: "mechanics",
  schedulingMode: "scheduled",
  commissionRate: 2500,
  checklistConfig: [{ category: "Battery Replace", items: ["Battery Voltage", "Terminal Corrosion", "Cable Condition", "Alternator Output", "Battery Tray"] }],
},
{
  name: "General Maintenance",
  slug: "general-maintenance",
  description: "General vehicle maintenance and minor repairs at your location.",
  basePrice: 9500,
  category: "mechanics",
  schedulingMode: "scheduled",
  commissionRate: 2500,
  checklistConfig: [{ category: "General Maintenance", items: ["Fluid Levels", "Belt Condition", "Hose Integrity", "Filter Status", "Light Function"] }],
},
{
  name: "AC Repair & Recharge",
  slug: "ac-repair",
  description: "Mobile AC diagnostics, repair, and refrigerant recharge service.",
  basePrice: 13000,
  category: "mechanics",
  schedulingMode: "scheduled",
  commissionRate: 2500,
  checklistConfig: [{ category: "AC Repair", items: ["Refrigerant Level", "Compressor Function", "Condenser Condition", "Evaporator Check", "Vent Temperature"] }],
},
{
  name: "Belt Replacement",
  slug: "belt-replacement",
  description: "On-site serpentine or drive belt replacement service.",
  basePrice: 11000,
  category: "mechanics",
  schedulingMode: "scheduled",
  commissionRate: 2500,
  checklistConfig: [{ category: "Belt Replacement", items: ["Belt Tension", "Pulley Alignment", "Tensioner Function", "Belt Routing", "Accessory Drive"] }],
},
```

**2. Beta config rows (new section after services seeding):**

```typescript
// ── BETA CONFIG ───────────────────────────────────────────
console.log("Seeding beta configuration...");
await db.insert(platformSettings).values([
  { key: "beta_mode_active", value: "true" },
  { key: "beta_start_date", value: "2026-04-07" },
  { key: "beta_end_date", value: "2026-06-07" },
]);
```

**3. Import addition** — add `platformSettings` to the import from `./schema`.

**4. Cleanup addition** — add `await db.delete(platformSettings);` before the services delete in the cleanup section.

### Anti-Patterns to Avoid

| DO NOT | INSTEAD |
|---|---|
| Use dollar amounts for prices | Use cents: $75 = 7500 |
| Use float for commission | Use basis points: 25% = 2500 |
| Set `schedulingMode: "both"` for mechanics | All mechanic services are `"scheduled"` only |
| Hardcode IDs | Let `createId()` generate them via `$defaultFn` |
| Skip cleanup of platformSettings | Add `db.delete(platformSettings)` to cleanup section |
| Insert beta_users seed data | beta_users table is populated via auto-enrollment, not seed |

### Dependencies and Scope

**Depends on:** Story 16.1 (enum + schedulingMode column), Story 16.2 (beta_users table must exist for FK integrity, though no beta_users are seeded)

**This story does NOT include:**
- Schema changes (Story 16.1)
- beta_users table creation (Story 16.2)
- API route changes (Story 16.5)
- Beta helper logic (Story 16.4)

### Testing Guidance

No test framework is installed. Verify manually:
1. Run `npm run db:seed` — completes without errors
2. Query services — 12 total (6 existing + 6 mechanics), all mechanics have `schedulingMode = 'scheduled'`
3. Query platform_settings — 3 beta config rows exist with correct keys/values
4. Run seed again — no duplicate errors (cleanup runs first)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 16, Story 16.3]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#Mechanic Service Catalog]
- [Source: _bmad-output/planning-artifacts/prd-mobile-mechanics-beta.md#FR-1.3, FR-1.8, FR-2.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 3: Beta Mode via Platform Settings]
- [Source: db/seed.ts — Existing seed pattern]
- [Source: db/schema/platform-settings.ts — Platform settings table definition]
