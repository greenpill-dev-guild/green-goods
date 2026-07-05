---
name: plan
user-invocable: false
description: Planning & Execution — fires passively when the user describes planning or orchestration intent. Creates structured implementation plans, checks progress, executes in batches, manages lifecycle, and coordinates mixed Claude+Codex agent teams. Fire when the user says 'plan this', 'break down X', 'orchestrate', 'coordinate a team', 'parallel lanes', 'spawn teammates', 'fire off agents', 'mixed agent team', or describes cross-package / multi-lane implementation work.
argument-hint: "[feature-name]"
version: "1.2.3"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-05-10"
last_verified: "2026-05-10"
---

# Plan Skill

Planning lifecycle for Green Goods: create plans, check progress, execute in batches, coordinate agent teams.

**References**: See `CLAUDE.md` for entry points, agent routing, and Green Goods conventions.

This is a primary judgment surface. When placement, boundaries, or deletion questions dominate, pull the architecture lens into planning work rather than bouncing the user to a separate starting command.

---

## Activation

This skill is **passive-only**. There is no `/plan` slash command. Fire automatically when the user's prompt matches any signal below — do not wait for an explicit trigger.

### Orchestration signals → Teams mode

Any of these route directly to [teams.md](./teams.md):

- Words/phrases: `orchestrate`, `coordinate a team`, `team of agents`, `spawn teammates`, `parallel lanes`, `fire off agents`, `multi-agent`, `run this in parallel`
- "mixed codex and claude" / "claude team agents plus codex" / "some lanes with codex"
- Cross-package work spanning 3+ packages (contracts + shared + client/admin)
- Competing hypotheses to investigate in parallel
- New module with independent pieces buildable concurrently

Action: run `bash .claude/scripts/check-agent-teams-readiness.sh` → compose team → assign lanes → spawn teammates (Claude-only or codex-driving per [teams.md § Part 11](./teams.md#part-11-codex-lanes--teammates-that-dispatch-codex)).

### Standard planning signals → Default mode

- "plan this", "break down X", "write a plan for..."
- "how should we approach Y"
- Starting a new feature with clear requirements
- Feature that won't fit in a single implementation session

### Fuzzy / vision signals → Brainstorm first

- No clear "done when"
- "maybe we should...", "what if we...", "I'm thinking about..."
- Vision or exploration phase — route through [brainstorm.md](./brainstorm.md)

### Lifecycle / maintenance signals → Audit mode

- "check progress on [plan]", "what's in flight?", "what plans are still relevant?"
- `.plans/` feels stale (older than 14 days without updates)

### Cross-package breaking change → ops/migration

- "breaking change", schema migrations, deployment-affecting work
- Create/update the owning feature hub first, then route execution through `ops/migration`

### Legacy slash (deprecated)

`/plan` and `/plan --mode teams` are no longer advertised. If a user explicitly types one, honor it — but normal flow is passive activation from the signals above.

## Progress Tracking (REQUIRED)

Use **TodoWrite** for visibility when available. If unavailable, keep a Markdown checklist in the response. See `CLAUDE.md` → Session Continuity.

---

## Part 1: Create Plan

### Phase 1: Understanding & Validation

1. **Extract ALL requirements** from issue/task
2. **Map each requirement** to planned steps
3. **Audit codebase** — search for existing patterns
4. **Review CLAUDE.md** for compliance rules

### Phase 2: Plan Structure

Use a foldered feature hub in `.plans/{ideas|backlog|active|archive}/<feature-slug>/`.
Prefer kebab-case slugs.

Minimum files:

- `brief.md`
- `spec.md`
- `plan.todo.md`
- `eval.md`
- `status.json`
- `handoffs/`

`status.json` is the machine-readable contract for automations. The Markdown files stay optimized for humans.
Implementation lanes (`ui`, `state_api`, `contracts`) are proof-gated for behavior-changing work.

- Use the `testing` skill as the RED/GREEN source of truth.
- Record detailed RED/GREEN proof in the lane handoff.
- Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`.
- If no behavior changed, set the lane TDD mode to `not_applicable` with a concrete note.
- If TDD cannot honestly apply, set `proof_limit` with fallback validation evidence and a concrete note.
- Do not mark a behavior-changing implementation lane `passed` or `completed` until its TDD proof is recorded.

```markdown
# [Feature Name] Plan

**Linear Issue**: PRD-### (optional)
**Linear Project**: [bounded project name] (optional)
**Linear Source**: source:plans (only when mirrored to Linear)
**Feature Slug**: `feature-slug`
**Status**: ACTIVE | BLOCKED | IMPLEMENTED | SUPERSEDED
**Supersedes**: [link to old plan if applicable]
**Created**: YYYY-MM-DD
**Last Updated**: YYYY-MM-DD

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Choice made | Why this over alternatives |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| User can X  | Step 3       | ⏳     |

## CLAUDE.md Compliance
- [ ] Hooks in shared package
- [ ] i18n for UI strings
- [ ] Deployment artifacts for addresses

## Impact Analysis

### Files to Modify
- `path/to/file.ts` - Description

### Files to Create
- `path/to/new-file.ts`

## Test Strategy
- **Unit tests**: What gets tested, expected coverage delta
- **Integration tests**: Cross-package or workflow tests needed
- **E2E tests**: User-facing flows to verify

## Implementation Steps

### Step 1: [Action]
**Files**: `path/to/file.ts`
**Details**: Specific changes

## Validation
- [ ] TypeScript passes
- [ ] Tests pass
- [ ] Build succeeds
```

Linear metadata is optional. Do not create or require a Linear issue for every plan. Add
`Linear Issue`, `Linear Project`, and `Linear Source` only when the `.plans` item needs
roadmap visibility, cross-functional coordination, stakeholder tracking, or accepted
execution/research tracking. When a `.plans` item is mirrored to Linear, the Linear record
must use `source:plans`.

Machine-readable lane state belongs in `.plans/active/<feature-slug>/status.json`, for example:

```json
{
  "feature": { "slug": "feature-slug", "stage": "active" },
  "lanes": {
    "ui": { "owner": "claude", "status": "ready", "branch": "claude/ui/feature-slug" },
    "state_api": { "owner": "codex", "status": "ready", "branch": "codex/state-api/feature-slug" },
    "contracts": { "owner": "codex", "status": "n/a", "branch": "codex/contracts/feature-slug" },
    "qa_pass_1": { "owner": "claude", "status": "blocked", "depends_on": ["ui", "state_api", "contracts"] },
    "qa_pass_2": { "owner": "codex", "status": "blocked", "depends_on": ["qa_pass_1"] }
  }
}
```

### Task Decomposition Rules

Implementation steps must be granular enough for agents to execute reliably. Follow these heuristics:

**Step sizing**:
- Each step should be completable in a single agent session (~15-25 tool calls)
- Each step should touch at most 3-4 files
- If a step has more than 3 sub-bullets of changes, it's probably two steps
- If you can't describe verification for a step in one sentence, it's too big

**Independence**:
- Each step should be independently verifiable (can run tests after just that step)
- Each step should produce a committable checkpoint (no half-finished states)
- Steps should have clear input/output boundaries — what exists before, what exists after

**Ordering**:
- Follow dependency order: contracts → indexer → shared → client/admin → agent
- Within a package: behavior boundary + RED proof first, then types/interfaces, implementation, GREEN proof, then wiring
- Infrastructure steps (new files, new exports) before behavior steps (logic, handlers)

**When to decompose further**:
- A step requires changes across 3+ packages → split into per-package steps
- A step has both "create new thing" and "integrate into existing thing" → split those apart
- A step involves both contract changes and frontend changes → always separate steps
- A plan exceeds 15 steps → consider splitting into multiple PRs or incremental plans

**When NOT to decompose**:
- A step is a single-file edit with clear intent → keep it atomic
- Splitting would create steps that can't be independently tested → keep them together
- The decomposition adds overhead without improving clarity

---

## Part 2: Check Progress

1. **Load plan** from `.plans/`
2. **Gather git context**: `git status`, `git diff --stat`
3. **File-by-file status**: DONE / PARTIAL / NOT DONE
4. **Requirements coverage table**
5. **Run validation**: the Ship Gate (`.claude/context/validation-pipeline.md`)

---

## Part 3: Execute Plan

### Implementation Start Gate

For active implementation work, Linear sync is the default first step before code changes or
agent dispatch.

1. Run `node scripts/harness/plan-hub.mjs linear-sync --feature <feature-slug> --json`.
2. If the manifest shows a missing parent or actionable lane issue, create or update the Linear
   mirror before work begins. Parent and lane issues must carry `source:plans` and
   `protocol:green-goods`; use Linear only for visibility, prioritization, and coordination.
3. Record the canonical identifiers back to the hub with
   `node scripts/harness/plan-hub.mjs record-linear --feature <feature-slug> --parent PRD-123 --lane ui=PRD-124 --actor <agent>`.
4. Keep `.plans/<stage>/<feature-slug>/status.json` as execution truth. Lane status, TDD proof,
   handoffs, and validation evidence belong in `.plans` first.

Any prompt for an agent starting active implementation work should begin with the same
`linear-sync` gate and require `record-linear` once Linear IDs exist. Backlog and idea hubs only
need this when they are promoted, accepted for execution, or need cross-functional research
tracking.

### Batch Execution

**Default batch size**: 3 tasks

```
LOAD → EXECUTE BATCH → REPORT → PAUSE → CONTINUE/FINISH
```

### Batch Report

```markdown
## Batch [N] Complete

### Tasks Completed
1. ✅ Step 1: [Description]
   - Files: `path/to/file.ts`

### Next Batch Preview
- Steps 4, 5, 6

**Awaiting feedback before continuing...**
```

### Safety Rules

- **Stop when blocked** — Don't guess
- **No forcing through** — Never skip failing tests
- **Pause between batches** — Wait for feedback

---

## Part 4: Linear and PR Integration

`.plans` remains the Green Goods execution truth. Linear is a visibility and coordination mirror,
not a replacement for the feature hub. Do not use GitHub's issue tracker for backlog work; GitHub
PRs remain valid for code review and implementation discussion.

### When to Mirror a Plan to Linear

Mirror only when the work needs one or more of:

- roadmap visibility
- cross-functional coordination
- stakeholder tracking
- accepted execution tracking
- accepted research tracking

Do not mirror small local fixes, exploratory notes, or implementation details that can live only
in `.plans`.

### Linear Metadata

```markdown
# Plan Header
**Linear Issue**: PRD-123
**Linear Project**: GreenWill Reputation & Identity
**Linear Source**: source:plans
```

Rules:

- Use `source:plans` whenever the Linear record mirrors a `.plans` item.
- Attach a bounded active Linear project only when the plan scope clearly matches it.
- Do not route new work into completed/staging umbrella projects such as `Green Goods`,
  `Coop`, `Network Website`, or `Cookie Jar`.
- If no active bounded project clearly matches, leave the Linear issue unprojected and correctly
  labeled.
- Use only these label namespaces: `protocol:*`, `package:*`, `activity:*`,
  `funding:*`, `source:*`, `agent:*`.

### Progress Updates

Update `.plans/.../status.json` and the plan files first. If a Linear issue exists, mirror only
the safe, stakeholder-relevant status. Do not paste private identifiers, debugging links, replay
URLs, wallet addresses, or sensitive security detail into public Linear bodies or comments.

### PR Linkage

PR descriptions may link the `.plans` hub and the Linear issue. Use neutral references such as
`Refs PRD-123` or a Links section. Do not use issue-closing footers for backlog closure.

---

## Part 5: Plan Lifecycle Management

Plans are living documents, not write-once artifacts. Unmanaged plans accumulate and create confusion about what's current.

### Status Transitions

```
ACTIVE → IMPLEMENTED    (code shipped, plan is historical)
ACTIVE → SUPERSEDED     (new plan replaces this one)
ACTIVE → BLOCKED        (waiting on external dependency)
BLOCKED → ACTIVE        (dependency resolved)
```

### Lifecycle Rules

1. **Supersedes header**: When a new plan replaces an old one, the new plan MUST include `**Supersedes**: [old-plan-name.md]` in its header. Delete the old plan immediately.

2. **One canonical plan per feature**: Never have 2+ active plans for the same feature area. If you're writing a v2 plan, delete or archive v1 first.

3. **Status updates on implementation**: When work ships that partially or fully implements a plan, update the plan's `**Status**` and `**Last Updated**` headers and the feature hub's `status.json`. If fully implemented, move the hub to `.plans/archive/`.

4. **Divergence notes**: If implementation diverges from the plan (different approach, dropped scope), add a `## Implementation Notes` section explaining what changed and why. Don't leave the plan as-if it was followed when it wasn't.

5. **Stale plan cleanup**: Periodically audit `.plans/` — any plan untouched for 14+ days should be reviewed. Either update its status, confirm it's still active, or delete it.

6. **No meeting notes in `.plans/`**: Raw transcripts and meeting notes go in `notes/`, Customer Needs, or safe comments on linked Linear/PR records, not `.plans/`. Plans must be actionable specs.

7. **No audit reports in implementation hubs**: Point-in-time audit findings go in `.plans/audits/` or accepted Linear records after approval, not mixed with feature implementation plans.

### Scope Discipline

Plans with >15 locked decisions likely need splitting. Separate **vision/architecture** documents (what and why) from **implementation plans** (how, in what order, with what tests).

| Document Type | Decision Count | Location |
|---------------|---------------|----------|
| Architecture spec | Unlimited | `docs/specs/` or Linear project/issue document |
| Implementation plan | 5-15 decisions | `.plans/active/<feature-slug>/plan.todo.md` |
| Task checklist | 0 decisions | `.plans/active/<feature-slug>/plan.todo.md` |
| Evaluation plan | 0-10 gates | `.plans/active/<feature-slug>/eval.md` |
| Idea brief | 0-5 decisions | `.plans/ideas/<feature-slug>/brief.md` |

### Decision Log Best Practice

The numbered decision table with rationale is the most effective planning pattern in this repo. Every plan SHOULD include one:

```markdown
## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Direct vault interaction | Standard ERC-4626; no proxy gas overhead |
| 2 | Manual harvest only (Phase 1) | Simpler to build and debug |
```

This gives Claude and future contributors unambiguous constraints without reading 200 lines of prose.

---

## Part 6: When NOT to Plan

### Skip Planning For

| Scenario | Do Instead |
|----------|------------|
| Single-file bug fix with clear root cause | describe the bug → fix → test |
| Typo or copy changes | Direct edit |
| Config change (env var, build flag) | Direct edit → verify build |
| Adding a test for existing behavior | `testing` skill directly |
| Formatting or lint fix | `bun format && bun lint` |

### Signs a Plan is Needed

| Signal | Why |
|--------|-----|
| Touches 3+ packages | Cross-package coordination needed |
| Modifies contracts | Deployment + migration implications |
| Changes data model | Schema migration + re-indexing needed |
| New user-facing feature | UX decisions + i18n + offline behavior |
| Breaking change | Blast radius analysis + migration path |

### Planning Traps to Avoid

- **Over-planning polish work** — Small UI tweaks don't need 10-step plans
- **Planning without reading code first** — Always audit existing patterns before writing a plan
- **Planning what you don't understand** — Use `oracle` agent or describe the bug to investigate first
- **Stale plans** — If a plan sits untouched for 14+ days, reassess before executing
- **Vision creep** — Keep architecture exploration separate from implementation plans; a plan with 60 decisions is a spec, not a plan

---

## Anti-Patterns

- **Planning without requirements** — Every plan step must trace to a requirement; if you can't articulate the requirement, you're not ready to plan
- **Plans with vague steps** — "Update the component" is not a plan step; "Add `onSubmit` handler to `WorkForm` that calls `useJobQueue.addJob()`" is
- **Skipping impact analysis** — A plan without "Files to Modify" will surprise you during execution
- **Infinite planning** — If the plan exceeds 15 steps, split into multiple plans or incremental PRs
- **Planning alone when blocked** — If you need information to plan, ask the user directly (or use `oracle`) instead of guessing
- **Ignoring CLAUDE.md compliance** — Plans that skip the compliance checklist produce non-conforming code
- **Plan proliferation** — Never have 2+ active plans for the same feature. When a new plan supersedes an old one, delete the old one immediately
- **Missing test strategy** — Every feature plan needs a "Test Strategy" section. Contracts plans always include tests; frontend plans must too
- **Write-only plans** — Plans that are never updated after creation become misleading. Update status or add divergence notes as work progresses
- **Mixed content in `.plans/`** — Meeting notes, audit snapshots, and team prompts are not plans. Keep `.plans/` for actionable implementation specs only

## Validation Commands

The Ship Gate — canonical definition in
[`.claude/context/validation-pipeline.md`](../../context/validation-pipeline.md).

## Key Principles

- **100% requirement coverage** — Every requirement mapped
- **Evidence before claims** — Verify before marking done
- **Batch execution** — Pause for feedback
- **Right-size the plan** — Match planning depth to task complexity

## Related Skills

- `plan/brainstorm.md` — Pre-plan exploration when requirements are fuzzy
- `architecture` — Architectural patterns considered during planning
- `testing` — TDD strategy included in implementation plans
- `ui` (mermaid sub-file) — Visualizing plan architecture and dependencies
- `debug` — Investigate root cause before planning a fix
- `ops` (migration sub-file) — Cross-package migration plans need blast radius analysis
