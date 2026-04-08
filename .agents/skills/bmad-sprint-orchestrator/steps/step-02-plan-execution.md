# Step 2: Plan Execution

**Goal:** Compute optimal wave grouping from the dependency graph and generate the sprint execution plan artifact.

---

## Process

### 2.1 Build Directed Acyclic Graph (DAG)

<action>Load {{dependency_manifest}}</action>
<action>Build adjacency list representation:</action>

```
For each story S in manifest:
  in_edges[S] = S.depends_on (stories that must complete before S)
  out_edges[S] = stories that depend on S
```

<action>Compute in-degree for each story (number of unresolved dependencies)</action>

### 2.2 Topological Sort with Wave Assignment

<action>Apply Kahn's algorithm with wave grouping:</action>

```
wave_number = 1
remaining = all stories in scope

while remaining is not empty:
  # Find all stories with in-degree 0 (no unresolved deps)
  ready = [S for S in remaining if in_degree[S] == 0]

  if ready is empty and remaining is not empty:
    ERROR: Circular dependency detected
    HALT with list of remaining stories

  # This set of ready stories forms a wave
  wave[wave_number] = ready

  # Remove ready stories and update in-degrees
  for S in ready:
    remaining.remove(S)
    for dependent in out_edges[S]:
      in_degree[dependent] -= 1

  wave_number += 1
```

### 2.3 Apply Parallelism Constraints

For each wave, apply these constraints to split oversized waves:

**Constraint 1: Max parallelism cap**
- If wave has more than {{max_parallelism}} stories, split into sub-waves
- Prioritize stories that unblock the most dependents
- Stories with more dependents execute in earlier sub-waves

**Constraint 2: Schema serialization**
- Within a wave, if multiple stories have `touches_schema: true` AND share schema files:
  - Move all but one to the next sub-wave
  - Order by: most dependencies unlocked first

**Constraint 3: File overlap serialization**
- Within a wave, if stories have overlapping files (`overlap_with` is non-empty):
  - Keep only one per overlapping group in the wave
  - Move others to next sub-wave
  - Maintain the overlap group's internal ordering

**Constraint 4: Repo separation benefit**
- Stories targeting different repos (`web` vs `mobile`) can ALWAYS parallelize
  even if one depends on the other's epic, because they're in separate git repos
- Exception: `both` stories must serialize their web part before mobile part

### 2.4 Optimize Wave Ordering

<action>Within each wave, order stories for optimal merge sequence:</action>

1. Schema-touching stories first (they provide foundation for others)
2. Backend/API stories second (they provide endpoints for UI stories)
3. Frontend/UI stories third
4. Mobile stories last (separate repo, no merge conflicts with web)

### 2.5 Generate Execution Plan

<action>Write {{execution_plan}} with this structure:</action>

```yaml
# Sprint Execution Plan — Sprint Orchestrator
# Generated: {date}
# Project: {project_name}

generated: {date}
base_branch: {base_branch}
epics_in_scope: [{epic_numbers}]
max_parallelism: {max_parallelism}
total_waves: {wave_count}
total_stories: {story_count}

# Wave definitions
waves:
  - id: 1
    status: pending          # pending | in-progress | done | partial
    stories:
      - key: {story-key}
        repo: web
        branch: sprint/{story-key}
        status: pending      # pending | in-progress | done | failed | blocked | blocked-upstream
        failure_reason: null
        agent_result: null
        review_result: null
        merge_result: null
      - key: {story-key-2}
        repo: web
        branch: sprint/{story-key-2}
        status: pending
        failure_reason: null
        agent_result: null
        review_result: null
        merge_result: null

  - id: 2
    status: pending
    stories:
      - key: {story-key-3}
        repo: mobile
        branch: sprint/{story-key-3}
        status: pending
        failure_reason: null
        agent_result: null
        review_result: null
        merge_result: null

# Execution log (appended during execution)
execution_log: []

# Blocked stories tracking
blocked_stories: []
```

### 2.6 Generate Wave Summary Table

<action>Build a human-readable table for the user checkpoint:</action>

```
| Wave | Stories | Repos | Parallelism | Key Files |
|------|---------|-------|-------------|-----------|
| 1    | 16-1, 16-2 | web, web | 2 | db/schema/services.ts, db/schema/beta-users.ts |
| 2    | 16-3, 16-5 | web, web | 2 | db/seed.ts, server/api/routes/services.ts |
| 3    | 16-4, 16-6 | web, web | 2 | server/api/lib/beta.ts, server/api/routes/bookings.ts |
| 4    | 16-7       | web     | 1 | admin components |
| 5    | 17-1, 17-2 | web, web | 2 | server/api/routes/bookings.ts, server/cron.ts |
| ...  | ...        | ...     | ... | ... |
```

<action>Return to workflow.md for user checkpoint</action>
