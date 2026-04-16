# Eval Runner Protocol

Step-by-step protocol for the runnable eval surface. This document covers only the automated `triage` and `code-reviewer` suites that remain live under `.claude/evals/`.

Manual benchmark material for `oracle`, `cracked-coder`, and cross-agent handoff tests is no longer part of the active workflow.

## Prerequisites

- Claude Code CLI installed and configured
- Working copy of the repository on the target branch
- `bun install` completed (dependencies available)
- Target agent definition at `.claude/agents/{agent-name}.md`

## Protocol

### Step 1: Select Eval Set

Choose a supported agent and eval case:

```
.claude/evals/{agent-name}/{task-file}.md
```

Supported agents:

- `triage`
- `code-reviewer`

Read the task file to understand the scenario, then read the corresponding `expected.json` for pass/fail criteria.

### Step 2: Prepare the Environment

```bash
# Prefer a clean worktree or a disposable branch
bun install
```

### Step 3: Spawn the Agent

Launch the target agent with the eval task as input. Use a worktree to isolate changes:

```bash
# Example: spawn triage with an eval task
claude --agent triage --worktree "Read .claude/evals/triage/p0-security.md and classify the issue."
```

Record:
- **Start time**: when the agent was spawned
- **Model**: which model version is being used (e.g., `opus-4.6`)
- **Turns used**: how many turns the agent consumed

### Step 4: Compare Output Against Expected

Open `expected.json` for the eval case and verify each check:

#### For Classification Agents (triage)

- Compare `severity`, `type`, `complexity` against expected values
- Score: exact match per field

#### For Review Agents (code-reviewer)

- Count true positives (expected findings found)
- Count false positives (findings not in expected set)
- Check verdict matches expected

### Step 5: Score the Run

Calculate the score using the `scoring` section in `expected.json`:

1. For each criterion, assign the weighted points if the check passes (0 if it fails)
2. Sum all points for the total score
3. Calculate percentage: `total_points / max_possible * 100`

### Step 6: Record Results

Add a row to `.claude/evals/README.md` Historical Results table:

```markdown
| YYYY-MM-DD | model-version | agent-name | score/max | task: notes |
```

### Step 7: Clean Up

```bash
# If using a worktree, it auto-cleans on session exit
# Otherwise, remove only eval artifacts you created locally
```

## Scoring Guide

| Score | Rating | Interpretation |
|-------|--------|---------------|
| 100% | Perfect | All checks pass, all criteria met |
| 80-99% | Strong | Minor issues only (e.g., missing optimization) |
| 60-79% | Passing | Core task done but pattern violations present |
| 40-59% | Weak | Significant gaps in output quality |
| < 40% | Fail | Agent did not achieve the task objective |

## Target Scores by Agent

| Agent | Metric | Target |
|-------|--------|--------|
| triage | Classification accuracy | >= 90% |
| code-reviewer | True positive rate | >= 85% |
| code-reviewer | False positive rate | <= 10% |

## Automated Runner (triage, code-reviewer)

Use the automated eval runner for the full live eval surface:

```bash
# Run a single eval
.claude/scripts/run-eval.sh triage p0-security
.claude/scripts/run-eval.sh code-reviewer known-bug-pr

# Override model
.claude/scripts/run-eval.sh triage p0-security --model haiku

# Preview without recording
.claude/scripts/run-eval.sh code-reviewer clean-pr --dry-run
```

The script spawns the agent via `claude -p`, scores output against `expected.json` criteria using keyword matching, and appends results to the Historical Results table. Output is saved to `.claude/evals/.runs/` for manual review.

## Tips

- Run evals after modifying agent definitions to catch regressions
- Run evals after model updates to verify capability consistency
- Compare results across model versions to track improvement/degradation
- If an agent consistently scores below target, review its constraints and workflow sections
- Use `--dry-run` to preview scoring without recording results
- Keep product acceptance work in `acceptance/`; it is a QA companion, not part of the automated runner
