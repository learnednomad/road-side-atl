# Step 4: Review and Merge

**Goal:** Code review each successfully completed story, then merge branches sequentially to the base branch with full test validation.

---

## Process

### 4.1 Identify Merge Candidates

<action>Load {{execution_plan}} for current wave</action>
<action>Filter stories with status `done` (agent completed successfully)</action>
<action>Sort merge candidates by optimal merge order:</action>

**Merge order priority:**
1. Stories with `touches_schema: true` — merge first (schema changes are foundational)
2. Stories that unblock the most downstream stories — merge earlier
3. Backend/API stories before frontend stories
4. Web stories before mobile stories (mobile has no merge conflicts with web)

<check if="no merge candidates (all stories failed)">
  <output>No stories to merge in Wave {{current_wave}} — all failed.</output>
  <action>Skip to Step 5</action>
</check>

### 4.2 Code Review Each Story

For each merge candidate, in merge order:

<action>Get the branch name from the execution plan (worktree branch)</action>
<action>Generate the diff for review:</action>

```bash
git diff {{base_branch}}...{{story_branch}} --stat
git diff {{base_branch}}...{{story_branch}}
```

<action>Launch a code review agent:</action>

```
Agent({
  description: "Review story {story-key}",
  subagent_type: "code-reviewer",
  prompt: "Review the following code changes for story {story-key}.

    Story requirements: [paste acceptance criteria from story file]

    Code diff:
    {diff_output}

    Review for:
    1. Correctness: Does the implementation satisfy ALL acceptance criteria?
    2. Security: Any injection, XSS, or auth bypass risks?
    3. Patterns: Does it follow existing Hono/Drizzle/Vitest patterns?
    4. Regressions: Could these changes break existing functionality?
    5. Tests: Are tests comprehensive? Do they test edge cases?
    6. Code quality: Naming, structure, unnecessary complexity?

    Report: APPROVE, CHANGES_REQUESTED:{list}, or REJECT:{reason}
    Keep review concise — focus on blocking issues only."
})
```

**Note:** Code reviews can run in PARALLEL for all merge candidates since they're read-only operations. Launch all review agents in a single message.

### 4.3 Process Review Results

For each reviewed story:

<check if="review result = APPROVE">
  <action>Set `story.review_result = "approved"` in execution plan</action>
  <action>Proceed to merge (4.4)</action>
</check>

<check if="review result = CHANGES_REQUESTED">
  <action>Log the requested changes</action>
  <action>Set `story.review_result = "changes_requested"` with details</action>
  <action>Set `story.status = "failed"` with reason "code review: changes requested"</action>
  <action>Preserve branch for manual fixes</action>
  <action>Mark downstream dependents as `blocked-upstream`</action>
</check>

<check if="review result = REJECT">
  <action>Set `story.review_result = "rejected"` with reason</action>
  <action>Set `story.status = "failed"`</action>
  <action>Preserve branch</action>
  <action>Mark downstream dependents as `blocked-upstream`</action>
</check>

### 4.4 Sequential Merge

<critical>Merges happen ONE AT A TIME in the computed merge order. Never parallel merge.</critical>

For each approved story, in merge order:

**Pre-merge checks:**
```bash
# Ensure base branch is clean and up-to-date
git checkout {{base_branch}}
git status  # must be clean

# Check if branch can merge cleanly
git merge --no-commit --no-ff {{story_branch}}
```

<check if="merge has conflicts">
  <action>Abort the merge: `git merge --abort`</action>
  <action>Set `story.merge_result = "conflict"` with conflicting files list</action>
  <action>Set `story.status = "failed"` with reason "merge conflict"</action>

  <output>**Merge Conflict — Story {story-key}**

    Conflicting files:
    {conflict_file_list}

    The branch `{{story_branch}}` could not merge cleanly into `{{base_branch}}`.
    This likely means a previously merged story in this wave modified overlapping files.

    **Options:**
    1. Resolve conflicts manually, then continue
    2. Skip this story and proceed with remaining merges
    3. HALT merge process
  </output>
  <ask>Choose [1], [2], or [3]:</ask>

  <check if="user chooses '1'">
    <action>Wait for user to resolve conflicts</action>
    <action>After resolution, continue merge process</action>
  </check>

  <check if="user chooses '2'">
    <action>Skip this story, preserve branch, mark blocked</action>
    <action>Continue with next merge candidate</action>
  </check>

  <check if="user chooses '3'">
    <action>HALT — user will handle manually</action>
  </check>
</check>

<check if="merge is clean">
  <action>Complete the merge:</action>

  ```bash
  # Merge was already staged from --no-commit above
  git commit -m "$(cat <<'EOF'
  Merge story {story-key}: {story-title}

  Epic: {epic_num}
  Wave: {wave_id}
  Story: {story-key}

  Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

  **Post-merge validation:**
  ```bash
  npm run build
  npm test
  npx eslint . --max-warnings 0
  ```

  <check if="build/tests/lint pass">
    <action>Set `story.merge_result = "success"`</action>
    <action>Set `story.status = "done"`</action>
    <action>Log event: `story-{story-key}-merged` with timestamp</action>
    <action>Continue to next merge candidate</action>
  </check>

  <check if="build/tests/lint FAIL">
    <action>Identify what failed and which files</action>

    <output>**Post-Merge Validation Failed — Story {story-key}**

      **Failures:**
      {failure_details}

      The merge succeeded but validation failed. This indicates a regression.

      **Options:**
      1. Revert the merge and quarantine story
      2. Attempt to fix the failures inline
      3. HALT for manual investigation
    </output>
    <ask>Choose [1], [2], or [3]:</ask>

    <check if="user chooses '1'">
      <action>`git revert HEAD --no-edit` to undo the merge commit</action>
      <action>Set `story.merge_result = "reverted"` with failure details</action>
      <action>Set `story.status = "failed"` with reason "post-merge regression"</action>
      <action>Mark downstream dependents as `blocked-upstream`</action>
    </check>

    <check if="user chooses '2'">
      <action>Attempt targeted fixes for the failures</action>
      <action>Re-run validation</action>
      <action>If passes: commit fix and mark done</action>
      <action>If still fails: revert and quarantine</action>
    </check>

    <check if="user chooses '3'">
      <action>HALT — user investigates</action>
    </check>
  </check>
</check>

### 4.5 Mobile Story Merges

For stories with `repo: mobile`:

<action>Switch to mobile repo: work in {{mobile_repo}}</action>
<action>Follow the same merge process but in the mobile repo</action>
<action>Mobile validation:</action>

```bash
cd ~/WebstormProjects/roadside-atl-mobile
npx tsc --noEmit
npx eslint .
```

<action>Return to web repo after mobile merges complete</action>

### 4.6 Clean Up Merged Worktrees

<action>For each successfully merged story:</action>

```bash
# The Agent tool with isolation: "worktree" auto-cleans if no changes.
# For branches that were merged, delete the branch:
git branch -d sprint/{story-key}
```

<action>For failed/quarantined stories: preserve branches for manual work</action>

### 4.7 Wave Results Summary

<action>Compile wave results:</action>

```
Wave {current_wave} Results:
  Total stories: {wave_story_count}
  Merged successfully: {merged_count}
  Failed (code review): {review_fail_count}
  Failed (merge conflict): {conflict_count}
  Failed (regression): {regression_count}
  Failed (agent error): {agent_fail_count}

  Preserved branches: {branch_list}
  Blocked downstream: {blocked_count} stories
```

<action>Return to workflow.md for user checkpoint</action>
