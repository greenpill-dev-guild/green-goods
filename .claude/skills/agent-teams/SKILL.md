---
name: agent-teams
description: Coordinate multiple Claude Code sessions as a team with shared tasks and inter-agent messaging.
argument-hint: "[build|review|investigate] [target]"
disable-model-invocation: true
---

# Agent Teams Skill

Coordinate multiple Claude Code instances working together. One session leads, teammates work independently with their own context, and they communicate directly with each other via a shared task list and messaging.

**References**: [Claude Code Agent Teams docs](https://code.claude.com/docs/agent-teams), `CLAUDE.md`, `.claude/hooks.json`.

> **Experimental feature** — requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"` in `.claude/settings.json` (already configured for this project).

---

## Activation

| Trigger | Action |
|---------|--------|
| `/teams` | Start a team for the current task |
| `/teams build <target>` | Parallel implementation team |
| `/teams review <target>` | Parallel review team (no implementation) |
| `/teams investigate <target>` | Competing-hypothesis debugging team |
| `"create an agent team"` | Natural language — Claude decides structure |

Before spawning, run preflight:

```bash
bash .claude/scripts/check-agent-teams-readiness.sh
```

If preflight fails, fall back to subagents (Task tool) with the same ownership model.

---

## Part 1: When to Use Teams vs Subagents

**Use agent teams when:**
- Research/review benefits from parallel exploration and debate
- New modules or features where teammates each own a separate piece
- Debugging with competing hypotheses tested in parallel
- Cross-layer coordination (contracts + shared + client changes)

**Use subagents (Task tool) instead when:**
- Tasks are sequential or have many dependencies
- Workers don't need to communicate with each other
- Same-file edits are required (teams cause overwrite conflicts)
- The task is routine and a single session handles it fine

| | Subagents | Agent Teams |
|---|---|---|
| **Context** | Own window; results return to caller | Own window; fully independent |
| **Communication** | Report back to main agent only | Teammates message each other directly |
| **Coordination** | Main agent manages all work | Shared task list with self-coordination |
| **Best for** | Focused tasks where only the result matters | Complex work requiring discussion |
| **Token cost** | Lower | Higher — scales with team size |

---

## Part 2: Team Composition

**Default: 3-4 teammates.** Claude decides team size based on the task. Only go to 5 when the task genuinely requires it. Never exceed 5 — token costs scale linearly.

### Green Goods Lane Model (suggested, not mandatory)

For cross-package work, align teammates to the dependency flow:

```
Lead (coordinates, synthesizes, reviews integration)
├─ chain-specialist      (contracts + indexer)
├─ middleware-specialist  (shared package)
└─ app-specialist         (client + admin)
```

For review or investigation, use independent specialists:

```
Lead (synthesizes findings, challenges claims)
├─ security-reviewer
├─ performance-reviewer
└─ test-coverage-reviewer
```

For debugging with competing hypotheses:

```
Lead (arbitrates, declares winner)
├─ hypothesis-A investigator
├─ hypothesis-B investigator
└─ hypothesis-C investigator
```

**Key principle: shape the team to the task, not the other way around.**

---

## Part 3: Lead Behavior

The lead coordinates — it does NOT implement while teammates are active.

Lead responsibilities:
- Create the team and spawn teammates with detailed context
- Create tasks in the shared task list (aim for 5-6 tasks per teammate)
- Monitor progress and redirect approaches that aren't working
- Challenge claims and request evidence before accepting findings
- Synthesize results across teammates
- Issue explicit PASS/FAIL verdict with reasons for review work
- Shut down teammates and clean up when done

If the lead starts implementing instead of waiting:

> "Wait for your teammates to complete their tasks before proceeding."

---

## Part 4: Spawning Teammates with Context

**Critical**: teammates do NOT inherit the lead's conversation history. They load CLAUDE.md and project context, but task-specific details must be in the spawn prompt.

Good spawn prompt:
```
Spawn a chain specialist teammate with this prompt:
"Review the HatsModule authorization flow in packages/contracts/src/modules/Hats.sol.
Focus on whether createHat permissions are correctly enforced when called from
GardenToken.createGarden(). The Hats Protocol requires wearing the parent hat
to create children — verify this is checked. Report findings with severity ratings."
```

Bad spawn prompt:
```
Spawn a teammate to review the contracts.
```

### Plan Approval for High-Risk Work

For contract changes or protocol-affecting work, require plan approval:

```
Spawn a chain specialist to refactor the deploy script.
Require plan approval before they make any changes.
```

The teammate works in read-only plan mode until the lead approves. Use this for:
- Any Solidity contract modifications
- Deploy script changes
- Changes affecting on-chain state

---

## Part 5: File Ownership (Conflict Prevention)

**Two teammates editing the same file causes overwrites.** Break work so each teammate owns different files.

| Lane | Owns | Does NOT touch |
|------|------|----------------|
| chain | `packages/contracts/**`, `packages/indexer/**` | shared, client, admin |
| middleware | `packages/shared/**` | contracts, client, admin |
| app | `packages/client/**`, `packages/admin/**` | contracts, shared |

When multiple teammates need to touch the same package (e.g., both need shared), split by directory:
- Teammate A owns `shared/src/hooks/garden/`
- Teammate B owns `shared/src/hooks/work/`

**Never assign two teammates to the same file.**

---

## Part 6: Task Sizing

Aim for **5-6 tasks per teammate**. This keeps everyone productive and lets the lead reassign work if someone gets stuck.

| Size | Example | Verdict |
|------|---------|---------|
| Too small | "Add a type annotation" | Coordination overhead > benefit |
| Just right | "Implement the useGardenPools hook with tests" | Self-contained, clear deliverable |
| Too large | "Refactor the entire shared package" | Too long without check-ins |

Tasks have three states: **pending** → **in_progress** → **completed**

Tasks can depend on other tasks — a pending task with unresolved dependencies can't be claimed until those complete.

---

## Part 7: Quality Gates (Hooks)

Two hook types enforce quality when teammates finish work:

### TeammateIdle Hook
Runs when a teammate is about to go idle. Exit code 2 sends feedback and keeps them working.

Script: `.claude/scripts/teammate-idle-gate.sh`
- Blocks idle when reason contains error signals (error, failed, timeout, crash)
- Requires retry or blocker report to lead

### TaskCompleted Hook
Runs when a task is being marked complete. Exit code 2 prevents completion and sends feedback.

Script: `.claude/scripts/task-completion-gate.sh`
- Validates the task has a clear deliverable
- Blocks completion on error signals in the task output

---

## Part 8: Cleanup

Always clean up through the lead, never through a teammate.

```
1. Ask each teammate to shut down (lead sends shutdown requests)
2. Wait for all teammates to confirm shutdown
3. Tell the lead: "Clean up the team"
```

The lead checks for active teammates before cleanup — shut them all down first.

---

## Part 9: Display Modes

| Mode | Setting | Best For |
|------|---------|----------|
| **in-process** (default) | `teammateMode: "in-process"` | Any terminal. Use Shift+Down to cycle through teammates. |
| **split-panes** | `teammateMode: "tmux"` | tmux or iTerm2. See all teammates at once. |

This project uses `"in-process"` by default (configured in `.claude/settings.json`).

**In-process controls:**
- **Shift+Down**: cycle through teammates
- **Enter**: view a teammate's session
- **Escape**: interrupt a teammate's current turn
- **Ctrl+T**: toggle the task list

---

## Part 10: Shortcut Templates

### `/teams build <target>`

Parallel implementation. Teammates each own a piece, build independently, lead integrates.

```
Create a team to implement <TARGET>.
- Assign each teammate a distinct set of files (no overlap)
- Create 5-6 tasks per teammate
- Use plan approval for any contract changes
- Wait for teammates to finish before integrating
```

### `/teams review <target>`

Parallel review. Each teammate applies a different lens. No implementation.

```
Create a team to review <TARGET>.
- Each teammate reviews from a different angle (security, performance, correctness, test coverage)
- Have teammates challenge each other's findings
- Synthesize into a severity-ranked report (Critical/High/Medium/Low)
```

### `/teams investigate <target>`

Competing hypotheses. Teammates test different theories and debate.

```
Create a team to investigate <TARGET>.
- Each teammate pursues a different hypothesis
- Have them actively try to disprove each other's theories
- The theory that survives is most likely the root cause
```

---

## Anti-Patterns

- Spawning 6+ teammates (token cost explodes, coordination degrades)
- Assigning two teammates to the same file (overwrite conflicts)
- Using teams for sequential, dependent work (use a single session)
- Lead implementing while teammates are active (lead should coordinate only)
- Spawn prompts without task-specific context (teammates can't read the lead's mind)
- Letting teams run unattended too long (check in, redirect, synthesize)
- Not cleaning up through the lead (orphaned resources)
- Using rigid team templates for every task (shape the team to the work)

---

## Related Skills

- `review` — severity and synthesis discipline
- `architecture` — boundary and entropy standards
- `plan` — structured implementation planning
- `debug` — root cause investigation (teams can parallelize hypotheses)
