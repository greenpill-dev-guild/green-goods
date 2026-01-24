# /plan - Planning & Execution

Create and execute implementation plans for features and tasks.

## Trigger

- `/plan [description]` - Create a new plan
- `/plan check` - Check progress on current plan
- `/plan execute` - Execute plan in batches

## Process

1. Load the `plan` skill from `.claude/skills/plan/SKILL.md`
2. Follow the skill workflow for the requested action

## Usage

### Create a Plan
```bash
/plan add garden metrics dashboard
/plan refactor authentication flow
/plan implement offline sync retry
```

### Check Progress
```bash
/plan check
```

### Execute Plan
```bash
/plan execute              # Execute current plan
/plan execute [plan-name]  # Execute specific plan
```

## Plan Location

All plans go to `.plans/` directory:
- Feature plans: `[feature-name].todo.md`
- Decisions: `decisions/ADR-NNN-*.md`
- Audits: `audits/[date]-audit.md`

## Batch Execution

Default: 3 tasks per batch

After each batch:
- Report completed tasks
- Show verification results
- Await feedback before continuing

## Verification

Run after each batch:
```bash
bun format && bun lint && bun test && bun build
```

## Output

Plan file with:
- Overview and requirements coverage
- CLAUDE.md compliance checklist
- Impact analysis (files to modify/create/delete)
- Implementation steps
- Validation criteria
