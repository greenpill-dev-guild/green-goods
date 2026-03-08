# Eval Runner Protocol

Step-by-step manual protocol for running agent evaluations, comparing output against expected results, and recording scores.

## Prerequisites

- Claude Code CLI installed and configured
- Working copy of the repository on the target branch
- `bun install` completed (dependencies available)
- Target agent definition at `.claude/agents/{agent-name}.md`

## Protocol

### Step 1: Select Eval Set

Choose the agent and eval case to run:

```
.claude/evals/{agent-name}/{task-file}.md
```

Read the task file to understand the scenario, then read the corresponding `expected.json` for pass/fail criteria.

### Step 2: Prepare the Environment

```bash
# Start from clean state
git stash  # or ensure working copy is clean
bun install

# For implementation agents (cracked-coder, migration):
# If the task requires synthetic code, create it per the task file instructions
```

### Step 3: Spawn the Agent

Launch the target agent with the eval task as input. Use a worktree to isolate changes:

```bash
# Example: spawn cracked-coder with an eval task
claude --agent cracked-coder --worktree "Read .claude/evals/cracked-coder/create-query-hook.md and complete the task described."
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

#### For Research Agents (oracle)

- Check if root cause / key findings match expected items
- Apply rubric scoring (weighted points per criterion)
- Verify confidence ratings are present

#### For Review Agents (code-reviewer)

- Count true positives (expected findings found)
- Count false positives (findings not in expected set)
- Check verdict matches expected

#### For Implementation Agents (cracked-coder, migration)

Run the automated checks:

```bash
# file_exists checks
ls -la {expected_file_paths}

# pattern_present checks
grep -n "{pattern}" {file}

# pattern_absent checks (should return no results)
grep -n "{pattern}" {file}

# barrel_export check
grep "{symbol}" {barrel_file}

# Verification
bun run test
bun lint
bun build
```

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
# If using worktree, it auto-cleans on session exit
# Otherwise, revert eval changes:
git checkout -- .
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
| oracle | Correct root cause identification | >= 80% |
| cracked-coder | Tests pass + build succeeds | 100% |
| migration | Per-package validation pass | 100% |
| storybook-author | Quality checklist compliance | >= 90% |

## Automated Runner (triage, code-reviewer)

For deterministic agents, use the automated eval runner instead of the manual protocol:

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

For non-deterministic agents (oracle, cracked-coder, migration, storybook-author), use the manual protocol above.

## Tips

- Run evals after modifying agent definitions to catch regressions
- Run evals after model updates to verify capability consistency
- Compare results across model versions to track improvement/degradation
- If an agent consistently scores below target, review its constraints and workflow sections
- Use `--dry-run` to preview scoring without recording results
