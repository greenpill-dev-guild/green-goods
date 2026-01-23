# /execute - Execute Implementation Plan

Execute a plan from `.plans/` directory in batches with review checkpoints.

## Trigger

User says `/execute` or `/execute [plan-name]`

## Process

1. Load the `executing-plans` skill from `.claude/skills/executing-plans/SKILL.md`
2. Find plan in `.plans/` directory
3. Execute in batches of 3 tasks
4. Pause between batches for feedback

## Quick Reference

```bash
# List available plans
ls .plans/*.todo.md

# Read specific plan
cat .plans/[plan-name].todo.md
```

## Batch Execution

Default: 3 tasks per batch

After each batch:
- Report completed tasks
- Show verification results
- Await feedback before continuing

## Verification

Run after each batch:
```bash
bun lint
bun test
bun build
```
