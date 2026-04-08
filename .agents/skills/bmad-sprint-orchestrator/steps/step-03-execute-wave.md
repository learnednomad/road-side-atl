# Step 3: Execute Wave

**Goal:** Launch parallel agents for all stories in the current wave, each in its own isolated worktree.

---

## Process

### 3.1 Prepare Wave

<action>Load {{execution_plan}}</action>
<action>Identify the current wave ({{current_wave}})</action>
<action>Get all stories in this wave with status `pending`</action>

<check if="no pending stories in wave">
  <action>All stories already processed — advance to Step 4</action>
</check>

<action>Update wave status to `in-progress` in {{execution_plan}}</action>
<action>Log event: `wave-{current_wave}-started`</action>

### 3.2 Build Agent Prompts

For each story in the wave, construct the agent prompt:

**Web stories (`repo: web`):**

```
You are a senior developer implementing story {story-key} for the road-side-atl project.
This is an autonomous implementation — execute completely without stopping for milestones.

## YOUR STORY
Read this file FIRST — it contains everything you need:
  {implementation_artifacts}/{story-key}.md

## PROJECT CONTEXT
Load these for coding standards and patterns:
  - docs/project-context.md (coding conventions, patterns)
  - _bmad-output/planning-artifacts/architecture.md (architecture decisions)
  - CLAUDE.md (git tagging, branch strategy, mobile parity policy)

## WAVE CONTEXT
You are part of Wave {wave_id}. Stories running in parallel with you:
{sibling_stories_with_files}

DO NOT modify any files listed under sibling stories above.
If you discover you need to modify a shared file, note it in the story's
Dev Agent Record and proceed with your story's files only.

## EXECUTION INSTRUCTIONS
Follow the bmad-dev-story workflow:
1. Read the story file completely — parse Story, ACs, Tasks, Dev Notes
2. Load project context for coding standards
3. For each task/subtask in order:
   a. Write FAILING tests first (red phase)
   b. Implement MINIMAL code to pass (green phase)
   c. Refactor while keeping tests green
   d. Mark task [x] when all tests pass
4. Run full test suite: npm test
5. Run build: npm run build
6. Run lint: npx eslint
7. Update story status to "review"
8. Commit all changes with descriptive message

## CODE CONVENTIONS (from project)
- All prices in cents (integer)
- Commission rates in basis points (10000 = 100%)
- Fire-and-forget notifications: .catch((err) => { console.error("[Notifications] Failed:", err); })
- DB IDs: text with createId() (cuid2-style)
- API routes: Hono framework in server/api/routes/
- DB schemas: Drizzle ORM in db/schema/
- Tests: Vitest in __tests__/ or *.test.ts

## HALT CONDITIONS
Stop and report if:
- 3 consecutive implementation failures
- Missing configuration or dependencies not in story spec
- Ambiguous requirements that could go multiple ways
- Test regressions you cannot resolve

Report your final status as: SUCCESS, HALT:{reason}, or FAILED:{error}
```

**Mobile stories (`repo: mobile`):**

```
You are a senior React Native developer implementing story {story-key} for the
roadside-atl-mobile project.

## YOUR STORY
Read this file FIRST:
  {web_repo}/{implementation_artifacts}/{story-key}.md

## MOBILE PROJECT
Working directory: ~/WebstormProjects/roadside-atl-mobile
Stack: Expo SDK 54, React Native 0.81.5, TypeScript, NativeWind, React Query, Zustand, MMKV
API client: src/lib/api/client.tsx (axios with JWT auth)
Features: src/features/[name]/ with api.ts (React Query hooks) + screen files
Routes: src/app/ (Expo Router file-based routing)

## EXECUTION INSTRUCTIONS
1. Read the story file for requirements and acceptance criteria
2. Implement following mobile conventions:
   - React Query hooks in feature api.ts files
   - NativeWind for styling (Tailwind classes)
   - Expo Router for navigation
   - MMKV for local storage
3. Test on iOS simulator if available
4. Commit all changes with descriptive message

## WAVE CONTEXT
Parallel stories: {sibling_stories_with_files}
DO NOT modify files listed under sibling stories.

Report your final status as: SUCCESS, HALT:{reason}, or FAILED:{error}
```

### 3.3 Launch Parallel Agents

<critical>All agents in a wave MUST be launched in a SINGLE message with multiple Agent tool calls</critical>

<action>For each story in the wave:</action>

```
Agent({
  description: "Implement story {story-key}",
  subagent_type: "general-purpose",
  isolation: "worktree",
  prompt: {constructed_prompt}
})
```

**Key parameters:**
- `isolation: "worktree"` — each agent gets its own git worktree (isolated copy of repo)
- `subagent_type: "general-purpose"` — needs full tool access (Read, Write, Edit, Bash, etc.)
- All agents launched in ONE message for true parallelism

**For mobile stories:**
- Do NOT use `isolation: "worktree"` (different repo)
- Instead, include explicit instructions to work in the mobile repo directory
- The agent will create its own branch in the mobile repo

### 3.4 Collect Results

<action>Wait for all agents to return</action>
<action>For each agent result, parse the outcome:</action>

| Result Pattern | Status |
|---------------|--------|
| Agent returns with changes, story status = "review" | `done` |
| Agent returns "SUCCESS" | `done` |
| Agent returns "HALT:{reason}" | `failed` with reason |
| Agent returns "FAILED:{error}" | `failed` with error |
| Agent returns with no changes (worktree cleaned up) | `failed` — no implementation |
| Agent timeout or error | `failed` — agent error |

<action>For each story, update {{execution_plan}}:</action>
- Set `story.status` based on result
- Set `story.agent_result` to summary of what the agent reported
- Set `story.branch` to the worktree branch name (returned by Agent tool)
- Set `story.failure_reason` if failed
- Log event: `story-{story-key}-{status}` with timestamp

### 3.5 Handle Failures

<action>For each failed story:</action>

1. Preserve the worktree/branch for manual investigation
2. Find all stories that depend on this story (directly or transitively)
3. Mark dependent stories as `blocked-upstream` in {{execution_plan}}
4. Add to `blocked_stories` list with reason

<action>If ALL stories in wave failed:</action>

<output>**Wave {current_wave} — All Stories Failed**

  {failure_details_per_story}

  **Impact:** {blocked_count} downstream stories now blocked.

  **Options:**
  1. Investigate failures and retry wave
  2. Skip this wave and attempt next (if any stories are unblocked)
  3. Pause orchestration
  4. Run correct-course
</output>

<action>Proceed to Step 4 regardless — even partial success needs review/merge</action>
