# Step 5: Advance Sprint

**Goal:** Update sprint tracking, compute the next wave, and determine whether to continue or complete.

---

## Process

### 5.1 Update Sprint Status

<action>Load {{sprint_status}} completely</action>

For each story processed in the completed wave:

<check if="story.status == 'done'">
  <action>Update `development_status[{story-key}]` = `done` in sprint-status.yaml</action>
</check>

<check if="story.status == 'failed'">
  <action>Update `development_status[{story-key}]` = `in-progress` in sprint-status.yaml</action>
  <note>Keep as in-progress, not a new status — failed stories need manual attention but
    should not pollute the standard status flow</note>
</check>

<check if="story.status == 'blocked-upstream'">
  <action>Keep current status in sprint-status.yaml (still ready-for-dev)</action>
  <note>Blocked stories haven't been attempted — they remain ready-for-dev</note>
</check>

**Epic status updates:**
<action>For each epic that had stories in this wave:</action>
<action>Check if ALL stories in the epic are now `done` in sprint-status.yaml</action>

<check if="all stories in epic are done">
  <action>Update `development_status[epic-{num}]` = `done`</action>
</check>

<check if="at least one story is in-progress or ready-for-dev">
  <action>Ensure `development_status[epic-{num}]` = `in-progress`</action>
</check>

<action>Update `last_updated` field to current date</action>
<action>Save sprint-status.yaml preserving ALL comments and structure</action>

### 5.2 Update Execution Plan

<action>Load {{execution_plan}}</action>

<action>Set current wave status:</action>

<check if="all stories in wave are done">
  <action>Set wave status = `done`</action>
</check>

<check if="some stories done, some failed">
  <action>Set wave status = `partial`</action>
</check>

<check if="all stories failed">
  <action>Set wave status = `failed`</action>
</check>

<action>Append to execution_log:</action>

```yaml
- timestamp: {current_datetime}
  event: wave-{current_wave}-completed
  result: {done|partial|failed}
  stories_merged: {count}
  stories_failed: {count}
  stories_blocked: {count}
```

<action>Save execution plan</action>

### 5.3 Compute Next Wave

<action>Identify remaining stories with status `pending` in execution plan</action>

<action>For each pending story, check if ALL its dependencies are now `done`:</action>
- Check the story's `depends_on` list in dependency manifest
- Each dependency must have status `done` in the execution plan
- If any dependency is `failed` or `blocked-upstream`, mark this story as `blocked-upstream`

<action>Collect all unblocked pending stories into {{next_wave_candidates}}</action>

<check if="next_wave_candidates is empty AND pending stories remain">
  <output>**All Remaining Stories Are Blocked**

    Stories still pending: {pending_list}
    Blocked by failed stories: {blocker_list}

    No more stories can proceed until failed stories are resolved.

    **Options:**
    1. Retry failed stories (will re-enter Wave execution)
    2. Manually unblock specific stories (remove dependencies)
    3. End orchestration — handle remaining stories manually
  </output>
  <action>Return to workflow.md for user decision</action>
</check>

<check if="next_wave_candidates is not empty">
  <action>Apply parallelism constraints from Step 2 (max_parallelism, schema serialization, file overlap)</action>
  <action>Create next wave entry in execution plan</action>
  <action>Set {{current_wave}} = next wave id</action>

  <output>**Next Wave Ready: Wave {next_wave_id}**

    Stories: {story_list}
    Parallelism: {count}
    Repos: {repo_list}
  </output>

  <action>Return to workflow.md — will loop to Step 3</action>
</check>

<check if="no pending stories remain">
  <action>Sprint orchestration is complete</action>

  **Final statistics:**
  <action>Compute totals across all waves:</action>
  - Total stories attempted: sum of all non-pending stories
  - Successfully merged: count of `done` stories
  - Failed: count of `failed` stories
  - Blocked (never attempted): count of `blocked-upstream` stories
  - Waves executed: count of waves with status != `pending`

  **Branch cleanup:**
  <action>List any remaining sprint/* branches that were not merged</action>
  <action>These belong to failed/quarantined stories — do NOT delete</action>

  <action>Return to workflow.md for final summary</action>
</check>

### 5.4 Progress Report

<action>Generate a progress snapshot for the user:</action>

```
Sprint Orchestration Progress
═════════════════════════════
Epic {n}: ████████░░ {done}/{total} stories ({pct}%)
Epic {n}: ░░░░░░░░░░ {done}/{total} stories ({pct}%)

Waves completed: {completed_waves}/{total_waves}
Current velocity: {stories_per_wave} stories/wave

Failed stories requiring attention:
  - {story-key}: {failure_reason}
  - {story-key}: {failure_reason}

Blocked stories (waiting on fixes):
  - {story-key}: blocked by {blocker}
```
