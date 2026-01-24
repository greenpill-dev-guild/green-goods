# Plan Skill

Planning lifecycle for Green Goods: create plans, check progress, execute in batches.

**References**: See `CLAUDE.md` for entry points, agent routing, and Green Goods conventions.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/plan` | Create new implementation plan |
| `/plan check` | Audit progress against plan |
| `/plan execute` | Execute plan in batches |
| Starting new feature | Create plan before coding |

## Progress Tracking (REQUIRED)

Every planning workflow MUST use **TodoWrite** for visibility. See `CLAUDE.md` → Session Continuity.

---

## Part 1: Create Plan

### Phase 1: Understanding & Validation

1. **Extract ALL requirements** from issue/task
2. **Map each requirement** to planned steps
3. **Audit codebase** — search for existing patterns
4. **Review CLAUDE.md** for compliance rules

### Phase 2: Plan Structure

Use kebab-case: `[descriptive-name].todo.md` in `.plans/`

```markdown
# [Feature Name]

**GitHub Issue**: #[number]
**Status**: Planning → In Progress → Done

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| User can X  | Step 3       | ⏳     |

## CLAUDE.md Compliance
- [ ] Hooks in shared package
- [ ] i18n for UI strings
- [ ] Deployment artifacts for addresses

## Impact Analysis

### Files to Modify
- `path/to/file.ts` - Description

### Files to Create
- `path/to/new-file.ts`

## Implementation Steps

### Step 1: [Action]
**Files**: `path/to/file.ts`
**Details**: Specific changes

## Validation
- [ ] TypeScript passes
- [ ] Tests pass
- [ ] Build succeeds
```

---

## Part 2: Check Progress

1. **Load plan** from `.plans/`
2. **Gather git context**: `git status`, `git diff --stat`
3. **File-by-file status**: DONE / PARTIAL / NOT DONE
4. **Requirements coverage table**
5. **Run validation**: `bun format && bun lint && bun test && bun build`

---

## Part 3: Execute Plan

### Batch Execution

**Default batch size**: 3 tasks

```
LOAD → EXECUTE BATCH → REPORT → PAUSE → CONTINUE/FINISH
```

### Batch Report

```markdown
## Batch [N] Complete

### Tasks Completed
1. ✅ Step 1: [Description]
   - Files: `path/to/file.ts`

### Next Batch Preview
- Steps 4, 5, 6

**Awaiting feedback before continuing...**
```

### Safety Rules

- **Stop when blocked** — Don't guess
- **No forcing through** — Never skip failing tests
- **Pause between batches** — Wait for feedback

---

## Part 4: GitHub Integration

### Link Issue to Plan

```markdown
# Plan Header
**GitHub Issue**: #123
**Closes**: #123
```

### Update Progress

```bash
gh issue comment [NUMBER] --body "## Progress: Steps 1-3 complete"
```

### On Completion

```bash
gh issue close [NUMBER] --comment "All steps complete, PR ready"
```

---

## Validation Commands

```bash
bun format && bun lint && bun test && bun build
```

## Key Principles

- **100% requirement coverage** — Every requirement mapped
- **Evidence before claims** — Verify before marking done
- **Batch execution** — Pause for feedback
