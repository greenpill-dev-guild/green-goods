---
name: plan
user-invocable: false
description: Planning & Execution — fires passively when the user describes planning or orchestration intent. Creates structured implementation plans, checks progress, executes in batches, manages lifecycle, and coordinates mixed Claude+Codex agent teams. Fire when the user says 'plan this', 'break down X', 'orchestrate', 'coordinate a team', 'parallel lanes', 'spawn teammates', 'fire off agents', 'mixed agent team', or describes cross-package / multi-lane implementation work.
argument-hint: "[feature-name]"
---

# Plan Skill

Planning lifecycle for Green Goods: create plans, check progress, execute in batches, coordinate agent teams.

**References**: See `CLAUDE.md` for entry points, agent routing, and Green Goods conventions.

This is a primary judgment surface. When placement, boundaries, or deletion questions dominate, weigh them directly inside the planning work (layering rules live in CLAUDE.md and `.claude/context/*.md`) rather than bouncing the user to a separate command.

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

### Cross-package breaking change → dependency-order migration

- "breaking change", schema migrations, deployment-affecting work
- Create/update the owning feature hub first, then sequence execution in dependency order (contracts → shared → indexer → client/admin → agent) with explicit blast-radius analysis

---

## Part 1: Create Plan

### Phase 1: Understanding & Validation

1. **Extract ALL requirements** from issue/task
2. **Map each requirement** to planned steps
3. **Audit codebase** — search for existing patterns
4. **Read the Implementation Quality Contract** in `.claude/context/values.md`
5. **Review CLAUDE.md** for compliance rules

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

- Use `.claude/context/testing.md` as the RED/GREEN source of truth.
- Record detailed RED/GREEN proof in the lane handoff.
- Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`.
- If no behavior changed, set the lane TDD mode to `not_applicable` with a concrete note.
- If TDD cannot honestly apply, set `proof_limit` with fallback validation evidence and a concrete note.
- Do not mark a behavior-changing implementation lane `passed` or `completed` until its TDD proof is recorded.

Copy-paste shapes — the plan header/body template, the `status.json` lane-state example, and
the batch-report template — live in [templates.md](./templates.md). Load it when writing the
plan, not before.

Linear metadata is optional. Do not create or require a Linear issue for every plan. Add
`Linear Issue`, `Linear Project`, and `Linear Source` only when the `.plans` item needs
roadmap visibility, cross-functional coordination, stakeholder tracking, or accepted
execution/research tracking. When a `.plans` item is mirrored to Linear, the Linear record
must use `source:plans`. Machine-readable lane state belongs in
`.plans/active/<feature-slug>/status.json`.

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
5. **Run validation according to intent**: use the Validation Intent Ladder in `CLAUDE.md`; QA Speed Mode for narrow progress proof, Repo Quick Gate for cross-package checkpoints, and Ship Gate only for explicit ship/PR/merge/release readiness.

---

## Part 3: Execute Plan

### Implementation Start Gate

For active implementation work, Linear sync is the default first step before code changes or
agent dispatch.

1. Run `node scripts/harness/plan-hub.mjs linear-sync --feature <feature-slug> --json`.
2. Respect `manifest.laneSyncMode`. When it is `parent_only`, create or update only the parent
   mirror and do not create lane issues unless Afo explicitly expands the Linear footprint. Record
   that mode with `--lane-sync-mode parent_only`.
3. When `manifest.laneSyncMode` is `lane_issues` and the manifest shows a missing parent or
   actionable lane issue, create or update the Linear mirror before work begins. Parent and lane
   issues must carry `source:plans` and `protocol:green-goods`; use Linear only for visibility,
   prioritization, and coordination.
4. Record the canonical identifiers back to the hub. Parent-only example:
   `node scripts/harness/plan-hub.mjs record-linear --feature <feature-slug> --parent PRD-123 --lane-sync-mode parent_only --actor <agent>`.
   Lane-issue example:
   `node scripts/harness/plan-hub.mjs record-linear --feature <feature-slug> --parent PRD-123 --lane ui=PRD-124 --lane-sync-mode lane_issues --actor <agent>`.
5. Keep `.plans/<stage>/<feature-slug>/status.json` as execution truth. Lane status, TDD proof,
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

Report each batch with the batch-report template in [templates.md](./templates.md).

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

Rules: team routing, project attachment, label namespaces, and the privacy boundary follow
[`.claude/context/linear-routing-rules.md`](../../context/linear-routing-rules.md) — do not
restate them here. Plan-specific deltas:

- Use `source:plans` whenever the Linear record mirrors a `.plans` item.
- Linear *project* descriptions (not issues) follow
  `.claude/context/linear-project-template.md`.

### Progress Updates

Update `.plans/.../status.json` and the plan files first. If a Linear issue exists, mirror only
the safe, stakeholder-relevant status, respecting the routing-rules privacy boundary.

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

7. **No generic audit storage in the plan hub**: Point-in-time audit findings stay
   in the response; accepted findings go to Linear after approval. A report belongs
   in an existing feature hub only when it is direct evidence for that feature.

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

The numbered decision table with rationale is the most effective planning pattern in this repo. Every plan SHOULD include one (filled example in [templates.md](./templates.md)) — it gives Claude and future contributors unambiguous constraints without reading 200 lines of prose.

---

## Part 6: When NOT to Plan

### Skip Planning For

| Scenario | Do Instead |
|----------|------------|
| Single-file bug fix with clear root cause | describe the bug → fix → test |
| Typo or copy changes | Direct edit |
| Config change (env var, build flag) | Direct edit → verify build |
| Adding a test for existing behavior | Write it directly — conventions in `.claude/context/testing.md` |
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
- **Planning without reading code first** — Always audit existing patterns before writing a plan; investigate what you don't understand (describe the bug, or dispatch a research subagent)
- **Vague steps** — "Update the component" is not a plan step; "Add `onSubmit` handler to `WorkForm` that calls `useJobQueue.addJob()`" is
- **Missing test strategy** — Every feature plan needs a "Test Strategy" section. Contracts plans always include tests; frontend plans must too
- **Stale plans** — If a plan sits untouched for 14+ days, reassess before executing
- **Vision creep** — Keep architecture exploration separate from implementation plans; a plan with 60 decisions is a spec, not a plan

---

## Validation Commands

Use `CLAUDE.md § Validation Intent Ladder` to choose the rung. The command definitions
for QA Speed Mode examples, Repo Quick Gate, and the full Ship Gate live in
[`.claude/context/validation-pipeline.md`](../../context/validation-pipeline.md).

## Related Skills

- `plan/templates.md` — Copy-paste plan/status/batch-report templates
- `plan/brainstorm.md` — Pre-plan exploration when requirements are fuzzy
- `plan/teams.md` — Mixed Claude+Codex agent-team orchestration
- `debug` — Investigate root cause before planning a fix
- `review` — Post-implementation review of the executed plan
