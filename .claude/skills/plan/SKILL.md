---
name: plan
description: Create, check, execute, and close implementation plans, and coordinate agent teams when asked. Use when the user asks to plan or break down work, explore a fuzzy idea, check progress on a plan, close or archive one, sequence a breaking change, improve architecture (deepen modules, find seams, reduce coupling, improve testability), or run work as parallel agent lanes.
user-invocable: false
argument-hint: "[feature-name]"
---

# Plan

## Adapter

Read `.agents/adapter.md` at the repository root: section `## plan`, plus `## checks` for commands. If the file, a section, or a field is missing, say so in one line and use the defaults written as "(default: ...)". Adapter fields are the bold names that follow `## checks` or carry a "(default: ...)". Without `## checks`, take commands from the repository's package scripts, Makefile, or CI config, name the ones you used, and treat auth, payment, and deploy code as critical. **Context** lists the guides that hold entry points, routing, conventions, and layering rules (default: the repository agent guide).

## Modes

The planning lifecycle: shape fuzzy ideas, write plans, check progress, execute in batches, close plans, and coordinate agent teams. Weigh placement, boundary, and deletion questions inside the planning work instead of sending the user elsewhere.

| Mode | Signals | Go to |
|---|---|---|
| default | "plan this", "break down X", "write a plan for...", "how should we approach Y", a new feature with clear requirements, work too big for one session | Create a plan |
| brainstorm | no clear "done when"; "maybe we should...", "what if we...", "I'm thinking about..."; vision or exploration | [brainstorm.md](brainstorm.md) |
| architecture | "improve the architecture", "deepen modules", "find better seams", "reduce coupling", testability, locality, agent coding velocity, hotspots, what architecture work to do next | Architecture mode |
| audit | "check progress on X", "what's in flight?", "which plans are still relevant?", plans untouched for 14+ days | Check progress |
| close | "close", "archive", or "clean up" a plan, or a PR finishes one | Close a plan |
| migration | a breaking change, schema migration, or deployment-affecting work | Create or update the owning plan first, then order execution by **Dependency order** (default: dependencies before dependents) with an explicit blast-radius analysis |
| teams | "orchestrate", "coordinate a team", "team of agents", "spawn teammates", "parallel lanes", "fire off agents", "multi-agent", "run this in parallel"; lanes split between interactive teammates and a dispatched agent CLI; work across 3+ packages; competing hypotheses; a new module with independently buildable pieces | [teams.md](teams.md) |

## Create a plan

### Understand
1. Extract every requirement from the issue or task, and map each one to planned steps.
2. Resolve factual prerequisites: read obvious local sources directly, and send bounded questions that need reconciled evidence to the `research` skill before asking the user.
3. Read **Quality bar** (default: the repository agent guide) and the rules in **Context**.

### Structure
Write the plan where **Plan location** says (default: a plans folder the user confirms), with the files **Plan files** lists (default: one Markdown plan holding a decision log, requirements coverage, impact analysis, test strategy, steps, and validation). Copy-paste shapes are in [templates.md](templates.md); load it when writing the plan, not before.

Behavior-changing implementation lanes are proof-gated (**Lanes and proof**; default: every implementation step is a lane):
- Record RED and GREEN proof in the lane handoff, and machine state where **Lanes and proof** says.
- No behavior change: mark the lane's test-first mode not applicable, with a concrete note. Test-first cannot honestly apply: record the proof limit, the fallback validation evidence, and a concrete note.
- Never mark a behavior-changing lane passed or completed before its test-first proof is recorded.
- Write validation status last. Every green, passed, completed, or merge-ready claim carries a **receipt** from a fresh run: tested commit SHA, UTC time, exact command, summarized output. Record a commit-attributed receipt only when `git status --porcelain=v1 --untracked-files=all -- <validated paths>` is empty; staged, unstaged, or untracked validated code is not represented by the SHA. Never copy an older lane's evidence forward as current proof.
- An evidence-only follow-up may keep its tested parent's proof only with a recorded, path-scoped `git diff --exit-code <tested>..HEAD -- <validated paths>` showing implementation, dependencies, configuration, and validation entrypoints unchanged, plus that empty status. Any change on those paths needs a fresh run.
- Lane state proves orchestration, not current validation: fill the lane handoff's validation receipt before setting the lane passed or completed. Reviewers treat a missing or stale receipt as pending evidence.

### Decompose
- **Size**: a step fits one agent session (about 15 to 25 tool calls), touches at most 3 or 4 files, and has verification you can state in one sentence. More than 3 sub-bullets of changes means two steps.
- **Independence**: each step is verifiable on its own, ends at a committable checkpoint, and has clear before and after states.
- **Order**: follow **Dependency order** (default: dependencies before dependents). Within a package: behavior boundary and RED proof, then types and interfaces, implementation, GREEN proof, then wiring. New files and exports come before behavior.
- **Split further** when a step spans 3+ packages (one step per package), mixes creating a thing with integrating it, or crosses an **Always-separate** boundary (default: none). Past 15 steps, consider several PRs or incremental plans.
- **Keep atomic** a single-file edit with clear intent, or any split that would leave steps you cannot test on their own.

## Architecture mode

1. **Scope the scan**: the subsystem the user named, else a bounded recent history where repeatedly changed paths, recurring test or mocking friction, and cross-file navigation cost mark the hotspots. State the search boundary.
2. **Read the decisions**: nearby package guides, **Architecture guide** (default: none), the owning plan, and existing decision records.
3. **Rank three to six candidate cards**, each with: concrete friction, current interface, deletion-test result, dependency category, before and after shape, locality or leverage effect, test migration, risk, confidence, and the overarchitecture you rejected.
4. **Stop for human selection.** Unselected and deferred cards stay in the owning plan, outside any registry, with no implementation prescribed.
5. **Design the selected interface.** Design it twice only for a protected, cross-package, or caller-facing interface with two materially different viable shapes; no report or subagent fan-out is required.
6. **Route the accepted work**: record `SELECTED`, the chosen interface, migration, proof, and risk in the owning plan, then follow **Seam registry** (default: none).

Architecture mode is discovery and design, not a license for blanket layering: prefer the smallest change that creates real locality or leverage, and reject candidates that fail the deletion test.

## Check progress

1. Load the plan from **Plan location**.
2. Gather `git status` and `git diff --stat`.
3. Mark each file DONE, PARTIAL, or NOT DONE, and build the requirements coverage table.
4. Validate by intent with `## checks` **Tiers**: `targeted` for narrow progress, `checkpoint` for cross-package checkpoints, `push` for ordinary publication, and `full` only for explicit full-local readiness or a release. Critical surfaces run their mandatory override.

## Execute

Before code changes or agent dispatch on active work, run **Start gate** (default: none), and begin every implementation prompt you hand another agent with the same gate.

Work in batches of 3 tasks: load, execute the batch, report it with the batch template, pause for feedback, then continue or finish. Stop when blocked instead of guessing, never skip a failing test, and pause between batches.

## Tracker mirror

The plan is the execution truth; a tracker is a visibility and coordination mirror, never a replacement. Mirror a plan only when the work needs roadmap visibility, cross-functional coordination, stakeholder tracking, or accepted execution or research tracking; keep small local fixes, exploratory notes, and implementation detail in the plan alone. Update the plan first, then mirror only safe, stakeholder-relevant status. Mechanics, metadata, sync commands, and closing steps are in **Tracker mirror** (default: no mirror without the user's go).

## Close a plan

A close takes two commits: the plan records its final state, then the archive removes it. Never archive a plan whose closeout record is uncommitted, because the archive keeps only what was committed. The PR that finishes a plan carries steps 1 to 5; step 6 lands right after the human merge. **Closeout** holds the commands and paths for every step (default: plain git and the plan files).
1. **Choose the resolution**: `completed` only when every lane is terminal with its receipts; otherwise the honest resolution **Closeout** lists.
2. **Scan for references** to the plan outside it. Code, tests, and CI must not read plan files: move any data they read into its package first. Update the references and regenerate derived files.
3. **Write the closeout record**: final status, last-updated date, and a closeout section naming what shipped, why this resolution, and where every open item goes (an issue, another plan, or explicitly dropped).
4. **Mirrored plans**: finish the closing steps in **Tracker mirror**, confirming the sync last.
5. **Commit the record by itself.**
6. **Archive, then commit** the deletion, the ledger entry, and the reference updates together.
7. **Verify** the plan store and the moved references, and confirm the archive commit's parent shows the closeout section.

### Lifecycle rules
- Status moves: ACTIVE to IMPLEMENTED (shipped), SUPERSEDED (replaced), or BLOCKED (waiting on a dependency); BLOCKED back to ACTIVE.
- A replacing plan names the old one in a `Supersedes` header; close the old plan as superseded.
- One canonical plan per feature: retire v1 before writing v2.
- On full or partial implementation, update the plan's status and last-updated headers and its machine state; close only through Close a plan, and claim `completed` only when the evidence supports it.
- When implementation diverges, add `## Implementation Notes` saying what changed and why.
- Review stale plans (untouched 14+ days, or already merged) on the cadence **Lifecycle** names (default: whenever a plan is opened): update, confirm, or close with an honest resolution.
- Plans are actionable specs: raw transcripts and meeting notes go where **Lifecycle** says (default: outside the plan store).
- Point-in-time audit findings stay in the response; direct evidence for a plan is recorded where **Lifecycle** says, not in a new report file.
- Dated reports are immutable (**Lifecycle**): record a correction or closure where **Lifecycle** says, linking the original.

### Scope discipline
More than 15 locked decisions means the plan needs splitting. Keep vision and architecture specs (what and why, unlimited decisions) apart from implementation plans (how and in what order, 5 to 15 decisions); task checklists hold no decisions, evaluation plans 0 to 10 gates, idea briefs 0 to 5 decisions. **Plan files** says where each lives. Every plan should carry a numbered decision log with rationale: it gives later readers unambiguous constraints without the prose.

## When not to plan

Skip planning for a single-file bug with a clear root cause (describe, fix, test), a typo or copy change, a config change (edit, then verify the build), a test for existing behavior, or a format or lint fix (`## checks` **Tiers**). A plan is needed when work touches 3+ packages, changes a data model or deployed interface, adds a user-facing feature, breaks compatibility, or matches **Plan triggers** (default: none).

Planning traps: over-planning polish work; planning before reading existing patterns (use `research` for factual prerequisites and `debug` for bugs; ask the user only for judgment, preference, or private context); vague steps ("update the component" instead of naming the handler and the call it makes); a feature plan with no Test Strategy section; executing a plan untouched for 14+ days without reassessing; vision creep, where a plan with 60 decisions is a spec.

Related: `research` before planning, `debug` before planning a fix, `review` after execution.
