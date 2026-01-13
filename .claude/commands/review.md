# /review - Review Changes

Review working copy changes against the implementation plan.

## Trigger

User says `/review` or "review changes"

## Process

1. Load the `check-plan` skill from `.claude/skills/check-plan/SKILL.md`
2. Identify relevant plan from `.plans/` directory
3. Compare implementation against plan requirements
4. Generate progress report

## Quick Reference

```bash
# View changes
git status
git diff

# Find plans
ls .plans/*.todo.md
```

## Output

Progress report showing:
- Completion percentage
- Step-by-step status
- Remaining work
- Quality assessment
