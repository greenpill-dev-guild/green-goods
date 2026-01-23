# Requesting Code Review Skill

Guide for when and how to request code reviews using the code-reviewer agent.

## Activation

Use when:
- After completing a task
- Before merging to main
- When stuck on implementation
- Before major refactoring

## When Reviews Are Mandatory

- After each task in subagent-driven development
- After completing major features
- Before merge to main
- After contract changes (always)

## When Reviews Are Optional (But Valuable)

- When stuck on implementation
- Before refactoring existing code
- When unsure about approach
- For learning/feedback

## Process

### Step 1: Prepare for Review

```bash
# Get commit range
git log main..HEAD --oneline

# Verify build passes
bun build

# Run tests
bun test

# Check linting
bun lint
```

### Step 2: Request Review

Use the code-reviewer agent with this template:

```markdown
## Review Request

### Commits
[git log output or commit range]

### Context
[Brief description of what was implemented]

### Specific Concerns
[Any areas you want extra attention on]

### Related Issue
[Link to GitHub issue if applicable]
```

### Step 3: Dispatch Code-Reviewer Agent

The code-reviewer agent will:
1. Perform 6-pass analysis
2. Post findings to GitHub PR (auto)
3. Return summary

### Step 4: Act on Feedback

Severity levels determine response:

| Severity | Action |
|----------|--------|
| CRITICAL | Fix immediately, block merge |
| HIGH | Fix before proceeding |
| MEDIUM | Fix before merge |
| LOW | Consider for future |

## Integration with Development Workflows

### Subagent-Driven Development

After each subtask completion:
1. Mark task done
2. Request review
3. Fix issues
4. Move to next task

### Plan Execution

After completing task batches:
1. Complete batch of related tasks
2. Request review of batch
3. Fix issues
4. Continue to next batch

### Ad-Hoc Development

Before merging:
1. Complete implementation
2. Request review
3. Address all CRITICAL/HIGH
4. Merge

## Responding to Feedback

When reviewers provide feedback:

1. **For valid issues**: Fix at designated severity level
2. **For disagreements**: Push back with technical reasoning

Example pushback:
```
The suggested change would break offline functionality.
Here's a test demonstrating the current behavior works:
[test code or proof]
```

## Green Goods Specific

When requesting review, mention:
- Which package(s) affected
- If contracts changed (triggers extra scrutiny)
- If auth/encryption paths touched (100% coverage required)

Example request:
```markdown
## Review Request

### Commits
abc123..def456

### Context
Added new useGardenMetrics hook to shared package for
tracking garden activity metrics.

### Packages Affected
- packages/shared (new hook)
- packages/client (hook usage)

### Specific Concerns
- Offline sync behavior when metrics fail to submit
- Type safety of the metrics payload

### Related Issue
Closes #234
```

## Critical Principles

- **Never skip review because "it's simple"**
- **Never ignore CRITICAL issues**
- **Fix CRITICAL immediately, HIGH before proceeding**
- **Document reasoning for any pushback**
