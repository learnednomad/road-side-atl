# Sprint Orchestrator Workflow

**Goal:** Semi-autonomous sprint execution engine — analyze dependencies, parallelize story implementation via worktrees, manage the full dev → review → merge cycle across waves.

**Your Role:** Sprint orchestrator coordinating parallel story execution.
- Communicate all responses in {communication_language}
- Generate all documents in {document_output_language}
- Execute steps in order; user checkpoints are mandatory before advancing
- NEVER skip dependency analysis or user approval of the execution plan
- Maintain the execution plan artifact as persistent state for resumability

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `user_skill_level`
- `planning_artifacts`, `implementation_artifacts`
- `date` as system-generated current datetime

### Paths

- `sprint_status` = `{implementation_artifacts}/sprint-status.yaml`
- `epics_file` = `{planning_artifacts}/epics.md`
- `dependency_manifest` = `{implementation_artifacts}/dependency-manifest.yaml`
- `execution_plan` = `{implementation_artifacts}/sprint-execution-plan.yaml`
- `project_context` = `**/project-context.md` (load if exists)
- `architecture_file` = `{planning_artifacts}/architecture.md`

### Settings

- `max_parallelism` = 3 (configurable at Step 2 checkpoint)
- `base_branch` = `development`
- `mobile_repo` = `~/WebstormProjects/roadside-atl-mobile`
- `branch_prefix` = `sprint/`

---

## RESUME CHECK

<workflow>

<step n="0" goal="Detect resume from previous session">
  <check if="{{execution_plan}} file exists">
    <action>Load the FULL execution plan file</action>
    <action>Check for incomplete waves (stories with status != done and != failed)</action>

    <check if="incomplete waves found">
      <action>Identify the last completed wave number</action>
      <action>Identify stories in progress or pending</action>
      <action>Check git branches for existing sprint/* branches</action>

      <output>**Resuming Sprint Orchestration**

        **Previous Session State:**
        - Last completed wave: {{last_wave}}
        - Stories done: {{done_count}}
        - Stories pending: {{pending_count}}
        - Stories failed: {{failed_count}}
        - Active branches found: {{branch_list}}

        **Resume Options:**
        1. Continue from Wave {{next_wave}} (recommended)
        2. Retry failed stories from Wave {{failed_wave}}
        3. Start fresh (regenerate dependency manifest and execution plan)
      </output>
      <ask>Choose option [1], [2], or [3]:</ask>

      <check if="user chooses '1'">
        <action>Set {{current_wave}} = {{next_wave}}</action>
        <goto step="3">Execute next wave</goto>
      </check>

      <check if="user chooses '2'">
        <action>Reset failed stories to pending status in execution plan</action>
        <action>Unblock dependents of failed stories</action>
        <action>Set {{current_wave}} = {{failed_wave}}</action>
        <goto step="3">Execute retry wave</goto>
      </check>

      <check if="user chooses '3'">
        <action>Archive existing execution plan as sprint-execution-plan.prev.yaml</action>
        <goto step="1">Fresh start</goto>
      </check>
    </check>

    <check if="no incomplete waves (all done or failed)">
      <output>**Sprint Complete**

        Previous orchestration finished. All waves processed.
        Run `sprint-status` to see results, or start a new sprint scope.
      </output>
      <ask>Start a new sprint orchestration? Specify epic range (e.g., "16-19") or [q] to quit:</ask>

      <check if="user provides epic range">
        <action>Store {{epic_scope}} from user input</action>
        <goto step="1">Fresh start with new scope</goto>
      </check>

      <check if="user chooses 'q'">
        <action>HALT - No work needed</action>
      </check>
    </check>
  </check>

  <check if="{{execution_plan}} does NOT exist">
    <goto step="1">Fresh start</goto>
  </check>
</step>

## EXECUTION

<step n="1" goal="Parse dependencies and build dependency graph">
  <critical>This step generates the dependency manifest that drives all parallelization decisions</critical>
  <action>Follow the instructions in ./steps/step-01-parse-dependencies.md</action>

  <!-- CHECKPOINT: User reviews dependency graph -->
  <output>**Dependency Graph Generated**

    File: {{dependency_manifest}}

    **Summary:**
    - Total stories in scope: {{total_stories}}
    - Web-only stories: {{web_count}}
    - Mobile-only stories: {{mobile_count}}
    - Cross-repo stories: {{cross_count}}
    - Schema-touching stories: {{schema_count}}

    **Dependency Graph:**
    {{formatted_dependency_graph}}

    Please review the dependency manifest. You can:
    1. Approve and continue to execution planning
    2. Edit the manifest file and then continue
    3. Re-run dependency analysis with different scope
  </output>
  <ask>Choose [1], [2], or [3]:</ask>

  <check if="user chooses '2'">
    <action>Wait for user to edit dependency-manifest.yaml</action>
    <action>Reload the manifest after user confirms edits</action>
  </check>

  <check if="user chooses '3'">
    <ask>Specify new epic scope (e.g., "16" or "16-17"):</ask>
    <action>Store new scope and restart step 1</action>
  </check>
</step>

<step n="2" goal="Plan execution waves">
  <action>Follow the instructions in ./steps/step-02-plan-execution.md</action>

  <!-- CHECKPOINT: User approves execution plan -->
  <output>**Execution Plan Generated**

    File: {{execution_plan}}

    **Wave Summary:**
    {{formatted_wave_table}}

    **Settings:**
    - Max parallelism: {{max_parallelism}}
    - Base branch: {{base_branch}}
    - Estimated waves: {{total_waves}}

    Please review the execution plan. You can:
    1. Approve and start execution
    2. Adjust max_parallelism (current: {{max_parallelism}})
    3. Edit the plan file and then continue
    4. Dry run only (stop after planning, don't execute)
  </output>
  <ask>Choose [1], [2], [3], or [4]:</ask>

  <check if="user chooses '2'">
    <ask>New max_parallelism value (1-5):</ask>
    <action>Update max_parallelism and recompute waves</action>
    <action>Regenerate execution plan</action>
    <action>Re-display wave summary</action>
  </check>

  <check if="user chooses '4'">
    <output>Dry run complete. Execution plan saved to {{execution_plan}}.
      Re-run orchestrator to execute.</output>
    <action>HALT - Dry run only</action>
  </check>
</step>

<step n="3" goal="Execute current wave">
  <critical>Launch parallel agents for all stories in the current wave</critical>
  <action>Follow the instructions in ./steps/step-03-execute-wave.md</action>
  <action>Wait for all agents in the wave to complete</action>
  <action>Collect results: success/failure/HALT for each story</action>
</step>

<step n="4" goal="Review completed stories and merge">
  <critical>Code review each story, then merge sequentially to base branch</critical>
  <action>Follow the instructions in ./steps/step-04-review-and-merge.md</action>

  <!-- CHECKPOINT: Wave results -->
  <output>**Wave {{current_wave}} Results**

    {{formatted_wave_results}}

    **Options:**
    1. Continue to next wave
    2. Retry failed stories in this wave
    3. Pause orchestration (resume later)
    4. Run `correct-course` to restructure sprint
  </output>
  <ask>Choose [1], [2], [3], or [4]:</ask>

  <check if="user chooses '2'">
    <action>Reset failed stories to pending in execution plan</action>
    <action>Unblock their dependents</action>
    <goto step="3">Re-execute wave with retries</goto>
  </check>

  <check if="user chooses '3'">
    <action>Save execution plan state</action>
    <output>Sprint paused. Re-run `orchestrate sprint` to resume from Wave {{next_wave}}.</output>
    <action>HALT - User requested pause</action>
  </check>

  <check if="user chooses '4'">
    <action>HALT - User wants to run correct-course</action>
  </check>
</step>

<step n="5" goal="Advance sprint to next wave">
  <action>Follow the instructions in ./steps/step-05-advance-sprint.md</action>

  <check if="more waves remain">
    <action>Set {{current_wave}} = {{next_wave}}</action>
    <goto step="3">Execute next wave</goto>
  </check>

  <check if="all waves complete">
    <output>**Sprint Orchestration Complete**

      **Final Summary:**
      - Total stories processed: {{total_processed}}
      - Stories completed: {{completed_count}}
      - Stories failed: {{failed_count}}
      - Stories blocked: {{blocked_count}}
      - Waves executed: {{waves_executed}}

      **Merged branches:** {{merged_branch_list}}

      **Next Steps:**
      1. Review sprint-status.yaml for final state
      2. Run `sprint-status` for detailed view
      3. Address any failed/blocked stories manually
      4. Run retrospective when ready
    </output>
  </check>
</step>

</workflow>
