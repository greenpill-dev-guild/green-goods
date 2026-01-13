# /plan - Create Implementation Plan

Create a detailed implementation plan for a feature or task.

## Trigger

User says `/plan [description]` or "create a plan for..."

## Process

1. Load the `create-plan` skill from `.claude/skills/create-plan/SKILL.md`
2. Extract requirements from user request
3. Audit codebase for related patterns
4. Create plan at `.plans/[name].todo.md`

## Output Format

Plan file with:
- Overview
- Requirements coverage table
- CLAUDE.md compliance checklist
- Impact analysis
- Implementation steps
- Removal specification
- Validation criteria

## Examples

```bash
/plan add garden metrics dashboard
/plan refactor authentication flow
/plan implement offline sync retry
```

## Plan Location

All plans go to `.plans/` directory:
- Feature plans: `[feature-name].todo.md`
- Decisions: `DECISIONS.md` or `decisions/ADR-NNN-*.md`
- Audits: `audits/[date]-audit.md`
