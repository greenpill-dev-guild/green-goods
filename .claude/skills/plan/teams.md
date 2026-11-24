# Agent teams

Part of the [plan skill](SKILL.md). Coordinate several agent sessions as one team: a lead, teammates with their own context, a shared task list, and direct messages between them. Scripts, lane models, ownership, and dispatch mechanics come from the adapter's `## plan` section, field **Teams**.

## Modes

| Mode | Signal |
|---|---|
| `teams` (default) | orchestration intent: "coordinate a team", "spawn teammates", "parallel lanes" |
| `teams-build` | orchestration plus implementation |
| `teams-review` | orchestration plus review: "parallel review", "team review" |
| `teams-investigate` | orchestration plus investigation: "competing hypotheses", "test theories in parallel" |

Run the **Teams** preflight before spawning (default: confirm the harness supports agent teams). If it fails, use subagents with the same ownership model.

## Teams or subagents

Use a team when parallel exploration and debate help, when teammates can each own a piece of a new module, for competing hypotheses, or for cross-layer coordination. Use subagents for sequential or dependent work, workers that never need to talk, same-file edits (teams overwrite each other), or routine work one session handles.

| | Subagents | Team |
|---|---|---|
| Context | own window; results return to the caller | own window; fully independent |
| Communication | report to the caller only | teammates message each other |
| Coordination | the caller manages all work | shared task list, self-coordinating |
| Best for | focused tasks where only the result matters | complex work that needs discussion |
| Token cost | lower | higher, scaling with team size |

## Composition

Default 3 to 4 teammates; 5 only when the task truly needs it; never more, because cost scales with every teammate. Shape the team to the task:
- Build: one teammate per lane along the dependency flow (**Teams** lane model).
- Review: independent specialists, such as security, performance, and test coverage, with the lead challenging claims.
- Investigate: one investigator per hypothesis, with the lead arbitrating and declaring the winner.

## Lead

The lead coordinates and never implements while teammates are active. It creates the team, spawns teammates with full task context, creates 5 or 6 tasks per teammate, monitors and redirects failing approaches, challenges claims and demands evidence, synthesizes results, gives an explicit PASS or FAIL with reasons for review work, and shuts teammates down at the end. A lead that starts implementing should wait for its teammates instead.

## Spawning

Teammates do not inherit the lead's conversation. They load the repository guides themselves, so every task-specific detail goes in the spawn prompt: the files, the flow to examine, the exact property to verify, and the report shape with severity ratings. "Review the contracts" is not a spawn prompt.

Require plan approval before changes on the **Teams** high-risk surfaces (default: deploy scripts, migrations, and anything that changes production state). The teammate stays in read-only plan mode until the lead approves.

## Ownership

Two teammates editing one file overwrite each other. Give each teammate a distinct set of files (**Teams** ownership table); when two need the same package, split it by directory. Never assign one file to two teammates.

## Tasks

Aim for 5 or 6 tasks per teammate: everyone stays productive and the lead can reassign a stuck teammate's work. Too small: "add a type annotation" (coordination costs more than it saves). Right: "implement the X hook with tests". Too large: "refactor the whole package" (too long without a check-in). Tasks move pending → in_progress → completed, and a task with unresolved dependencies cannot be claimed.

## Completion signals

Completion hooks (**Teams**) keep a teammate working only when its idle reason or task output carries an error signal (error, failed, timeout, crash), and require a retry or a blocker report to the lead. Hooks run no package or repository suites: the lead owns validation.

## Cleanup

Clean up through the lead, never a teammate: send each teammate a shutdown request, wait for every confirmation, then clean up the team. The lead checks for active teammates first.

## Shortcuts

- Build: "Create a team to implement <TARGET>. Give each teammate a distinct set of files, 5 or 6 tasks each, plan approval for high-risk surfaces; integrate after the teammates finish."
- Review: "Create a team to review <TARGET>. One angle per teammate (security, performance, correctness, test coverage); have them challenge each other's findings; synthesize a Critical/High/Medium/Low report."
- Investigate: "Create a team to investigate <TARGET>. One hypothesis per teammate; each actively tries to disprove the others; the theory that survives is the likely root cause."

## Dispatched lanes

When some lanes are design-sensitive and others are spec-clear implementation, give the spec-clear lanes to teammates that dispatch a non-interactive agent CLI through the **Teams** dispatcher. The teammate drives the dispatch, not the lead: raw output, worktree paths, and cleanup stay out of the lead's context; results pass the same completion signals; the lead keeps managing teammates, not processes; and the teammate holding the task context reviews the output.

- **Assignment**: UI components, layouts, design iteration, responsive and accessibility polish, and cross-cutting state machines go to interactive teammates. Implementation from a clear spec, hooks and stores, mechanical transforms, test scaffolding from eval criteria, and string extraction or translation passes go to dispatched lanes. A review or QA pass after integration fits either; a dispatched pass works well there. An ambiguous lane goes to an interactive teammate, which may dispatch on its own. Lane owner is a hint, not a contract.
- **Spawn prompt**: name the lane, the base branch, the work branch, and the prompt file; say to run the dispatch in the background; check the result for success and passing tests; on a partial or failed result, read the reported issues and either re-dispatch with a refined prompt or report the blocker. On success: review the diff in the worktree, merge into the base without fast-forward, remove the worktree and work branch, and report the merge SHA, files changed, and any deviation from the prompt.
- **Ownership**: the rules above apply unchanged, one lane per teammate and no overlapping files. A dispatching teammate owns its worktree, its work branch, the files edited there, and merging back.
- **Parallel lanes** coordinate through the shared task list; a task's `depends_on` holds downstream lanes until upstream merges land. Example: lane A (dispatched) implementation, no deps; lane B (dispatched) hooks, no deps; lane C (interactive) UI, after A and B; lane D (dispatched) integration tests, after A, B, and C.
- **Dispatch prompts** (**Teams** prompt guide): state the goal, not the steps; name the files and plan docs to read; declare what not to do; include "Done when" with validation commands; ask for no upfront plan or status updates, which cause early stopping; repeat nothing the repository guide already says.

## Anti-patterns

Six or more teammates; two teammates on one file; teams for sequential, dependent work; a lead implementing while teammates work; spawn prompts without task context; teams left unattended too long; cleanup outside the lead; one rigid template for every task.
