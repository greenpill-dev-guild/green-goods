# Harness Design Patterns — GAN-Inspired Agent Architecture

**GitHub Issue**: N/A (internal capability upgrade)
**Branch**: `chore/harness-design-patterns`
**Status**: ACTIVE
**Created**: 2026-03-26
**Last Updated**: 2026-03-26

## Context

Anthropic's engineering blog ["Harness Design for Long-Running Application Development"](https://www.anthropic.com/engineering/harness-design-long-running-apps) proposes a GAN-inspired multi-agent architecture where a **Generator** creates output and an **Evaluator** grades it against concrete criteria in an iterative loop. The key meta-principle is **iterative simplification**: every harness component encodes an assumption about what the model can't do, and those assumptions go stale as models improve.

Green Goods already has the structural pieces — `cracked-coder` (generator), `code-reviewer` (evaluator), `oracle` (investigator), `/plan` (planner) — but they operate as **independent, manually-invoked agents**. This plan wires them into the feedback loops and handoff patterns the blog identifies as high-leverage.

### Blog Patterns → Green Goods Mapping

| Blog Pattern | Current State | Gap |
|---|---|---|
| Generator↔Evaluator loop | `cracked-coder` + `code-reviewer` exist but don't loop | No iterative feedback cycle |
| Sprint contracts | `/plan` creates steps but no machine-readable acceptance criteria | Evaluator can't grade against plan |
| Three-agent architecture (Plan→Gen→Eval) | All three roles exist as separate agents | No orchestrating harness |
| File-based agent communication | `session-state.md` exists for context continuity | Not structured as inter-agent handoff artifacts |
| Evaluator calibration via few-shot | Eval cases exist with `expected.json` | No calibration examples in agent prompts |
| Iterative simplification | 7 hooks, 6 agents, 19 skills | No process to audit which are still load-bearing |
| Live application testing | `claude-in-chrome` available but not wired to evaluator | Evaluator is code-only, never tests running app |

### Prior Art (from blog)

**Cost/quality tradeoff**: Solo agent (20 min, $9) produced broken output. Full harness (6 hr, $200) produced working product. Updated Opus 4.6 harness (3 hr 50 min, $125) achieved similar quality at lower cost by removing scaffolding the model no longer needed.

**Context anxiety**: Sonnet 4.5 wrapped up work prematurely near context limits. Opus 4.6 eliminated this, allowing context resets to be dropped entirely. Our `cracked-coder` scored 75/100 on `add-admin-component` (79 turns, exhausted) — the same failure mode.

**Evaluator tuning**: "Out of the box, Claude is a poor QA agent. It identified legitimate issues, then talked itself into deciding they weren't a big deal." Concrete criteria + few-shot calibration fixed this.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Start with sprint contracts before building the loop | Concrete criteria make the evaluator tractable (blog's core finding) |
| 2 | File-based handoffs over conversation threading | Blog found file artifacts more reliable than context passing; solves context exhaustion |
| 3 | Extend existing agents rather than creating new ones | Follows iterative simplification — add capabilities, don't add agents |
| 4 | Assumption audit as a recurring process, not a one-time step | Model capabilities change with each release; hooks that were essential become overhead |
| 5 | Defer Playwright evaluator to Phase 3 | High implementation effort; sprint contracts and feedback loop deliver value sooner |
| 6 | Build `/build` orchestrator as a skill, not a new agent | Skills are composable and user-invokable; agents are implementation details |
| 7 | Use `.plans/{task}/` directories for multi-agent handoffs | Keeps all artifacts for a task co-located; existing plan convention extends naturally |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Sprint contracts in plan output | Phase 1, Step 1 | ⏳ |
| Machine-readable acceptance criteria | Phase 1, Step 2 | ⏳ |
| Code-reviewer can grade against sprint contract | Phase 1, Step 3 | ⏳ |
| Eval case for sprint contract grading | Phase 1, Step 4 | ⏳ |
| File-based handoff artifact spec | Phase 2, Step 1 | ⏳ |
| cracked-coder writes handoff on exhaustion | Phase 2, Step 2 | ⏳ |
| Fresh agent resumes from handoff file | Phase 2, Step 3 | ⏳ |
| Eval case for context handoff | Phase 2, Step 4 | ⏳ |
| Generator↔Evaluator feedback loop | Phase 3, Step 1 | ⏳ |
| Evaluator few-shot calibration | Phase 3, Step 2 | ⏳ |
| `/build` orchestrating skill | Phase 3, Step 3 | ⏳ |
| Assumption audit protocol | Phase 4, Step 1 | ⏳ |
| Assumption audit execution (baseline) | Phase 4, Step 2 | ⏳ |
| Live application evaluator (Playwright) | Phase 5, Step 1 | ⏳ |

## CLAUDE.md Compliance

- [x] No hook changes required (extends existing agents/skills)
- [x] No package-specific .env
- [x] Uses `bun run test` convention
- [ ] Validation: `bun format && bun lint && bun run test && bun build`

---

## Phase 1: Sprint Contracts — Concrete Acceptance Criteria

**Goal**: Make `/plan` output machine-readable acceptance criteria that `code-reviewer` can grade against. This is the foundation — without concrete criteria, the evaluator can't be calibrated.

**Blog justification**: "Negotiating what 'done' looks like before any code is written" prevented subjective evaluation drift. The generator proposes success criteria; the evaluator reviews them before implementation starts.

### Step 1: Extend Plan Skill with Sprint Contract Block

**Files**: `.claude/skills/plan/SKILL.md`

Add a `## Sprint Contract` section to the plan template that produces graded acceptance criteria:

```markdown
## Sprint Contract

### Step N: [Step Title]
**Acceptance Criteria**:
- [ ] `AC-1`: [Specific, verifiable criterion] → `{file_path}:{pattern}`
- [ ] `AC-2`: [Specific, verifiable criterion] → `{file_path}:{pattern}`
- [ ] `AC-3`: [Specific, verifiable criterion] → `{file_path}:{pattern}`

**Verification Command**: `bun run test -- --grep "StepN" && bun build`
**Done When**: All criteria checked, verification passes
```

Each criterion maps to a file path and grep-able pattern, making it machine-evaluable. This mirrors the eval system's `expected.json` format but lives in the plan.

### Step 2: Define Sprint Contract Schema

**Files**: `.claude/registry/sprint-contract.schema.json` (new)

Create a lightweight JSON schema for the contract so both generator and evaluator parse it consistently:

```json
{
  "step": "string",
  "acceptance_criteria": [
    {
      "id": "AC-N",
      "description": "string",
      "check_type": "file_exists | pattern_present | pattern_absent | barrel_export | test_passes | build_succeeds",
      "file": "string (optional)",
      "pattern": "string (optional)"
    }
  ],
  "verification_command": "string",
  "done_when": "string"
}
```

This reuses the exact check types from `expected.json` in the eval system — consistency between plan contracts and eval scoring.

### Step 3: Extend Code-Reviewer to Grade Sprint Contracts

**Files**: `.claude/agents/code-reviewer.md`, `.claude/skills/review/SKILL.md`

Add a **Pass 0.25: Sprint Contract Compliance** to the 6-pass review:

> If a sprint contract exists at `.plans/{task}/*.todo.md`, extract the acceptance criteria for the steps included in this PR. For each criterion, verify pass/fail with evidence (file:line or command output). Report as a table before the standard review passes.

This is additive — the reviewer still does its 6 passes but now also grades against the plan's contract. If no contract exists, this pass is skipped.

### Step 4: Eval Case for Contract-Graded Review

**Files**: `.claude/evals/code-reviewer/sprint-contract-grading.md` (new)

Create an eval where:
1. A plan exists with 5 acceptance criteria
2. An implementation satisfies 3/5 criteria (two deliberate failures)
3. Expected: reviewer identifies the 2 failures, grades correctly, cites the contract

**Scoring**: Contract criteria identification accuracy (target ≥ 90%).

---

## Phase 2: File-Based Handoffs — Context Continuity Between Agents

**Goal**: When an agent exhausts its context window or needs to hand off to another agent, it writes a structured artifact that a fresh agent can resume from. This directly addresses the 75/100 `add-admin-component` failure.

**Blog justification**: "Context resets provide a clean slate, at the cost of the handoff artifact having enough state for the next agent to pick up the work cleanly." File-based communication "kept the work faithful to the spec without over-specifying implementation too early."

### Step 1: Define Handoff Artifact Specification

**Files**: `.claude/context/handoff-spec.md` (new)

Standardize the handoff format that all agents produce when they need to pass work:

```markdown
## Handoff: [Task Name]
**From**: [agent-name] (turn N/max)
**Reason**: context_exhaustion | sprint_complete | blocked | phase_gate
**Timestamp**: YYYY-MM-DD HH:MM

### Completed
- [x] What was done (with file paths)

### Current State
- Tests: N passing, M failing
- Build: passing/failing
- Files modified: [list]

### Remaining
- [ ] What still needs doing (with specific instructions)

### Context the Next Agent Needs
- Key decisions made and why
- Patterns established (Cathedral Check references)
- Gotchas discovered

### Resume Command
`bun run test -- packages/shared` (to verify starting state)
```

This extends the existing `session-state.md` convention from CLAUDE.md but makes it an **inter-agent** artifact rather than an intra-session note.

### Step 2: Wire Handoff into cracked-coder Exhaustion Path

**Files**: `.claude/agents/cracked-coder.md`

The cracked-coder already has "Save `session-state.md` and `tests.json` before compaction." Extend its escalation rules:

> **At turn 40/50**: Write handoff artifact to `.plans/{task}/handoff-{N}.md` using the handoff spec. Include the sprint contract progress (which ACs are done, which remain). The next agent instance reads this file + the plan + `tests.json` to resume.

This replaces the current "approaching 40/50 turns → escalate" with a structured handoff that enables **automatic continuation** rather than requiring human intervention.

### Step 3: Wire Handoff into oracle → cracked-coder Chain

**Files**: `.claude/agents/oracle.md`

Oracle already has a "Handoff Brief" format (≤20 lines). Formalize it as a file write:

> When oracle completes investigation with `intent: implement`, write the handoff brief to `.plans/{task}/investigation.md`. This becomes the cracked-coder's input context alongside the plan.

This replaces the current integration eval's implicit contract with an explicit file artifact.

### Step 4: Eval Case for Handoff Continuity

**Files**: `.claude/evals/integration/handoff-continuity.md` (new)

Create an eval where:
1. A partially-completed implementation exists (3/5 acceptance criteria done)
2. A handoff artifact describes what's done and what remains
3. A fresh `cracked-coder` instance must complete the remaining 2 criteria

**Scoring**: All 5 criteria pass (100%), agent doesn't redo completed work, resumes from handoff cleanly.

---

## Phase 3: Generator↔Evaluator Feedback Loop

**Goal**: Wire `cracked-coder` and `code-reviewer` into an iterative loop where review findings feed back into implementation, with sprint contracts as the grading criteria.

**Blog justification**: "Separating the agent doing the work from the agent judging it proves to be a strong lever." The evaluator catches bugs the generator's self-evaluation misses, and concrete criteria prevent the evaluator from being lenient.

### Step 1: Define the Feedback Loop Protocol

**Files**: `.claude/skills/build/SKILL.md` (new — the orchestrating skill)

The loop:

```
1. cracked-coder implements sprint N
2. cracked-coder writes sprint-N-result.md (self-assessment against contract)
3. code-reviewer reads sprint-N-result.md + diff
4. code-reviewer writes sprint-N-review.md (pass/fail per AC + findings)
5. IF all ACs pass AND no critical/high findings → move to sprint N+1
6. IF failures exist → cracked-coder reads review, fixes, goto step 2
7. Max 3 iterations per sprint (Three-Strike Protocol alignment)
```

All communication happens via files in `.plans/{task}/`. No agent reads another agent's conversation — only the file artifacts.

### Step 2: Calibrate Code-Reviewer with Few-Shot Examples

**Files**: `.claude/agents/code-reviewer.md`

Add 2-3 calibration examples to the agent definition, drawn from actual eval results:

**Example 1** (True Positive — must catch):
> `known-bug-pr` eval: mutation `onError` handler catches error but doesn't call `createMutationErrorHandler()`. This is Critical severity because errors are silently swallowed, violating the "never swallow errors" principle.

**Example 2** (True Negative — must NOT flag):
> `clean-pr` eval: hook uses `queryKeys.gardens.members(gardenAddress, chainId)` with explicit `chainId` parameter. This follows the established queryKeys pattern — do not flag as "hardcoded value."

**Example 3** (Borderline — show reasoning):
> `hook-boundary-violation` eval: A utility function in `packages/client/src/utils/` that uses `useQuery` internally. This IS a hook boundary violation (Critical) even though the file is in `utils/`, because it calls a React hook.

These examples anchor the evaluator's judgment to the project's specific standards, addressing the blog's finding that "it took several rounds of this development loop before the evaluator was grading in a way that I found reasonable."

### Step 3: Create `/build` Orchestrating Skill

**Files**: `.claude/skills/build/SKILL.md` (new)

A user-invokable skill that runs the full pipeline:

```
/build "add funder leaderboard to admin"

Pipeline:
1. [Oracle] Gather context — relevant files, patterns, constraints
2. [Plan] Generate implementation plan with sprint contracts
3. [Human] Review plan, approve/modify sprint contracts
4. For each sprint:
   a. [Cracked-Coder] Implement against sprint contract
   b. [Code-Reviewer] Grade implementation against contract
   c. IF review passes → next sprint
   d. IF review fails → cracked-coder fixes (max 3 iterations)
   e. IF 3 strikes → escalate to human with full context
5. [Human] Final review of complete implementation
```

**Key design choice**: Human gates at plan approval (step 3) and final review (step 5). The automated loop runs between gates. This matches the blog's finding that "for tasks within the model's capability boundary, the evaluator became unnecessary overhead" — the human decides how much automation to apply.

---

## Phase 4: Assumption Audit — Iterative Simplification

**Goal**: Systematically test which harness components are still load-bearing with current model capabilities (Opus 4.6). Remove what's no longer needed.

**Blog justification**: "Every component in a harness encodes an assumption about what the model can't do on its own. Find the simplest solution possible, and only increase complexity when needed." Opus 4.6 specifically improved long-context retrieval and self-correction, potentially obsoleting some guardrails.

### Step 1: Define the Audit Protocol

**Files**: `.claude/evals/assumption-audit.md` (new)

For each harness component, run the relevant eval **with the component disabled** and compare scores:

| Component | Assumption | Eval to Run | Disable How |
|---|---|---|---|
| Hook: block hooks outside shared/ | Model creates hooks in wrong location | `cracked-coder/create-query-hook` | Temporarily remove PreToolUse hook matcher |
| Hook: block `bun test` | Model uses wrong test runner | `cracked-coder/create-query-hook` | Temporarily remove Bash hook matcher |
| Hook: post-write auto-format | Model doesn't format code | `cracked-coder/create-query-hook` | Temporarily remove PostToolUse hook |
| 6 context files | Model can't find patterns without pre-loading | `cracked-coder/create-query-hook` | Run agent without context file loading |
| Separate triage agent | Classification needs cheap fast pass | `integration/triage-to-cracked-coder` | Have oracle do classification inline |
| Three-Strike Protocol | Model loops forever on failures | `cracked-coder/fix-offline-sync-bug` | Remove strike counting from prompt |

**Methodology**: Remove one component at a time. If the eval score stays at target, the component is **no longer load-bearing** and can be simplified or removed. If the score drops, the component stays.

**Cadence**: Run after each major model update (aligned with existing eval trigger schedule).

### Step 2: Execute Baseline Audit

Run all 6 rows with Opus 4.6. Record as a table in eval results. This establishes the current baseline for which components matter.

---

## Phase 5: Live Application Evaluator (Future)

**Goal**: An evaluator that tests the running application via browser automation, catching visual and interaction bugs that code review misses.

**Blog justification**: The evaluator "used Playwright MCP to interact with running applications the way a user would — clicking buttons, testing flows, checking state."

### Step 1: Prototype with claude-in-chrome for Admin Package

**Files**: `.claude/skills/build/SKILL.md` (extend), new eval case

After `cracked-coder` completes a frontend sprint:
1. Start dev server (`bun dev`)
2. Use `claude-in-chrome` to navigate to the modified view
3. Execute user flows defined in the sprint contract
4. Screenshot/report visual or interaction issues

**Scope**: Admin package only (simpler than PWA client). Focus on:
- Component renders without errors
- Form interactions work (inputs, selects, modals)
- Data displays correctly (tables, cards, charts)

**Deferral reason**: Requires stable dev server, browser automation reliability, and visual assertion patterns. Higher effort than Phases 1-4 but highest potential impact for frontend quality.

---

## Implementation Steps Summary

| Phase | Steps | Effort | Files Modified | Files Created |
|---|---|---|---|---|
| **1: Sprint Contracts** | 4 | Low-Medium | plan/SKILL.md, code-reviewer.md, review/SKILL.md | sprint-contract.schema.json, sprint-contract-grading.md |
| **2: File Handoffs** | 4 | Low | cracked-coder.md, oracle.md | handoff-spec.md, handoff-continuity.md |
| **3: Feedback Loop** | 3 | Medium | code-reviewer.md | build/SKILL.md |
| **4: Assumption Audit** | 2 | Low | — | assumption-audit.md |
| **5: Live Evaluator** | 1 | High | build/SKILL.md | new eval case |

## Test Strategy

- **Eval-driven validation**: Each phase includes a new eval case that validates the pattern works
- **Regression**: Existing evals must maintain scores after changes (no degradation)
- **Integration**: Phase 3 eval tests the full Generator↔Evaluator loop end-to-end
- **Assumption audit**: Phase 4 explicitly tests removal of components

## Validation

```bash
# After each phase:
# 1. Run the new eval case for that phase
# 2. Run existing evals to verify no regression
.claude/scripts/run-eval.sh code-reviewer known-bug-pr
.claude/scripts/run-eval.sh code-reviewer clean-pr

# For implementation agents (manual):
# Spawn cracked-coder with relevant eval, verify score ≥ baseline
```

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Evaluator adds cost without catching real bugs | Phase 4 assumption audit measures evaluator ROI; skip for simple tasks |
| File handoffs lose critical context | Handoff spec includes "Context the Next Agent Needs" section; eval validates resumption |
| Sprint contracts become busywork | Contracts are optional — planner generates them, human can skip for simple steps |
| Feedback loop runs forever | Three-Strike Protocol caps at 3 iterations per sprint; escalates to human |
| Assumption audit removes something needed | Eval scores are the safety net — only remove if score holds |
