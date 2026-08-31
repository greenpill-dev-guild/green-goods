# Plan Templates

> Sub-file of the [plan skill](./SKILL.md). Copy-paste shapes for plan hubs — load when
> writing a plan, not on every activation.

## Plan Header + Body Template (`plan.todo.md`)

```markdown
# [Feature Name] Plan

**Linear Issue**: PRD-### (optional)
**Linear Project**: [bounded project name] (optional)
**Linear Source**: source:plans (only when mirrored to Linear)
**Feature Slug**: `feature-slug`
**Status**: ACTIVE | BLOCKED | IMPLEMENTED | SUPERSEDED
**Supersedes**: [link to old plan if applicable]
**Created**: YYYY-MM-DD
**Last Updated**: YYYY-MM-DD

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Choice made | Why this over alternatives |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| User can X  | Step 3       | ⏳     |

## CLAUDE.md Compliance
- [ ] Hooks in shared package
- [ ] i18n for UI strings
- [ ] Deployment artifacts for addresses
- [ ] Implementation Quality Contract applied; no speculative abstractions or mixed abstraction levels

## Impact Analysis

### Files to Modify
- `path/to/file.ts` - Description

### Files to Create
- `path/to/new-file.ts`

## Test Strategy
- **Unit tests**: What gets tested, expected coverage delta
- **Integration tests**: Cross-package or workflow tests needed
- **E2E tests**: User-facing flows to verify

## Implementation Steps

### Step 1: [Action]
**Files**: `path/to/file.ts`
**Details**: Specific changes

## Validation
- [ ] TypeScript passes
- [ ] Tests pass
- [ ] Build succeeds

### Fresh Evidence Receipt
- **Tested implementation commit SHA**: `<full SHA>`
- **Run at (UTC)**: `YYYY-MM-DDTHH:MM:SSZ`
- **Command**: `<exact command>`
- **Result**: `<counts or concise output summary>`
- **Validated paths**: `<implementation, dependency, configuration, and validation paths>`
- **Worktree identity command and result**: `git status --porcelain=v1 --untracked-files=all -- <validated paths>` → `<empty result>`
- **Evidence-only diff command and result (if applicable)**: `git diff --exit-code <tested>..HEAD -- <validated paths>` → `<result>`
- **Evidence-only worktree-status command and result (if applicable)**: `git status --porcelain=v1 --untracked-files=all -- <validated paths>` → `<empty result>`
```

## `status.json` Lane-State Example

```json
{
  "feature": { "slug": "feature-slug", "stage": "active" },
  "lanes": {
    "ui": { "owner": "claude", "status": "ready", "branch": "feature/profile-avatar-editor" },
    "state_api": { "owner": "codex", "status": "ready", "branch": "feature/profile-avatar-storage" },
    "contracts": { "owner": "codex", "status": "n/a", "branch": null },
    "qa_pass_1": { "owner": "claude", "status": "blocked", "depends_on": ["ui", "state_api", "contracts"] },
    "qa_pass_2": { "owner": "codex", "status": "blocked", "depends_on": ["qa_pass_1"] }
  }
}
```

## Batch Report Template

```markdown
## Batch [N] Complete

### Tasks Completed
1. ✅ Step 1: [Description]
   - Files: `path/to/file.ts`

### Next Batch Preview
- Steps 4, 5, 6

**Awaiting feedback before continuing...**
```

## Decision Log Example (filled)

```markdown
## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Direct vault interaction | Standard ERC-4626; no proxy gas overhead |
| 2 | Manual harvest only (Phase 1) | Simpler to build and debug |
```
