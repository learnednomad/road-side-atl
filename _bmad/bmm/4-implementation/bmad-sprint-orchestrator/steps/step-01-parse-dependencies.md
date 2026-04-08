# Step 1: Parse Dependencies

**Goal:** Build a complete dependency graph for all in-scope stories by analyzing epics, story files, and file-level overlap.

---

## Process

### 1.1 Identify Stories in Scope

<action>Load {{sprint_status}} completely</action>
<action>Identify all stories with status `ready-for-dev` or `in-progress`</action>
<action>If user provided {{epic_scope}}, filter to only stories in those epics</action>
<action>If no scope provided, include all `ready-for-dev` stories</action>

**Store as {{stories_in_scope}} — list of story keys**

### 1.2 Parse Inter-Epic Dependencies from Epics File

<action>Load {{epics_file}} completely</action>
<action>Find the "Cross-Initiative Dependency Map" section (typically near end of file)</action>
<action>Parse the dependency tree structure, e.g.:</action>

```
Epic 16 (Foundation) — no dependencies
  ├── Epic 17 — depends on Epic 16
  ├── Epic 18 — depends on Epic 16 + 17
  │     └── Epic 19 — depends on 16, 17, 18
```

<action>Extract epic-level dependencies as: `{epic_num: [depends_on_epic_nums]}`</action>

**Result:** Epic dependency map — all stories in Epic N depend on ALL stories in its parent epics being `done`.

### 1.3 Parse Intra-Epic Story Dependencies

<action>For each epic in scope, read the epic's Stories section in {{epics_file}}</action>
<action>Analyze each story's description for dependency signals:</action>

**Dependency signals to detect:**
- Explicit schema references: "Add column to X table" → depends on the story that creates/modifies that table
- File references: story modifies file X that another story also modifies → must serialize
- API references: story calls endpoint created by another story → depends on it
- Seed/config references: story needs data seeded by another story → depends on it
- Keyword patterns: "requires", "depends on", "after", "builds on", "extends"

**Intra-epic dependency rules:**
1. Schema migration stories (creating tables, adding columns) are serialized by default
2. Seed stories depend on the schema stories they seed into
3. API route stories depend on schema stories that define their tables
4. UI stories depend on the API stories they consume
5. Config/helper stories depend on schema stories they reference

### 1.4 Analyze Story Files for File-Level Overlap

<action>For each story in scope, read the story file from {{implementation_artifacts}}</action>
<action>Extract the **Files** section listing files to be created/modified</action>
<action>Build a file-overlap matrix: which stories touch the same files</action>

**File overlap rules:**
- Two stories modifying the SAME file → must be serialized (one depends on the other)
- Two stories in the same directory but different files → can parallelize (low conflict risk)
- Schema files (`db/schema/*.ts`) → always serialize stories touching the same schema file
- Migration files → always serialize (Drizzle generates sequential migrations)
- Route files (`server/api/routes/*.ts`) → serialize if same route file
- Shared lib files (`server/api/lib/*.ts`) → serialize if same file

### 1.5 Classify Stories by Repository

<action>For each story, determine target repository from Files section:</action>

| Pattern | Repo Classification |
|---------|-------------------|
| Files only in `db/`, `server/`, `components/`, `app/`, `lib/` | `web` |
| Files only reference "Mobile:" prefix | `mobile` |
| Files in both web paths and "Mobile:" paths | `both` |
| Story title contains "mobile" and no web file paths | `mobile` |

**Cross-repo stories (`both`)** are split into two dependency entries:
- `{story-key}-web` with web file dependencies
- `{story-key}-mobile` with mobile file dependencies and depends on `{story-key}-web`

### 1.6 Detect Schema-Touching Stories

<action>For each story, check if it modifies any of:</action>
- `db/schema/*.ts` files
- `db/seed.ts`
- Any file containing migration-related changes

<action>Mark `touches_schema: true` for these stories</action>

**Schema constraint:** Two stories with `touches_schema: true` that share ANY schema file MUST be serialized.

### 1.7 Generate Dependency Manifest

<action>Write `{{dependency_manifest}}` with this structure:</action>

```yaml
# Dependency Manifest — Sprint Orchestrator
# Generated: {date}
# Scope: Epics {epic_scope}
# Source: {epics_file}, story files in {implementation_artifacts}

generated: {date}
epic_scope: [{epic_numbers}]
total_stories: {count}

# Epic-level dependencies (all stories in child inherit these)
epic_dependencies:
  16: []
  17: [16]
  18: [16, 17]
  19: [16, 17, 18]

# Story-level dependency graph
stories:
  {story-key}:
    depends_on: [{dependency-keys}]
    epic: {epic_num}
    repo: web | mobile | both
    touches_schema: true | false
    files:
      - {file-path-1}
      - {file-path-2}
    overlap_with: [{stories-sharing-files}]
```

### 1.8 Validate Dependency Graph

<action>Check for circular dependencies — if found, HALT with error</action>
<action>Check that every dependency target exists in the manifest</action>
<action>Check that inter-epic dependencies are reflected in story-level deps</action>
<action>Verify no orphan stories (stories not reachable from any root)</action>

### 1.9 Visualize for User Review

<action>Generate a text-based dependency tree for display:</action>

```
Epic 16 (no deps):
  Wave candidates:
    [16-1] extend-service-category-enum → no deps
    [16-2] create-beta-users-table → no deps
    [16-3] seed-mechanic-services → depends on: 16-1, 16-2
    [16-4] beta-helper-trust-tier → depends on: 16-3
    [16-5] category-filter-services-api → depends on: 16-1
    [16-6] beta-status-endpoint → depends on: 16-2, 16-3
    [16-7] admin-beta-toggle → depends on: 16-6

Epic 17 (depends on Epic 16):
  [17-1] enforce-scheduled-at → depends on: ALL of Epic 16
  ...
```

<action>Return to workflow.md for user checkpoint</action>
