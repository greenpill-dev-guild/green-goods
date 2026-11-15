# Plan templates

Part of the [plan skill](SKILL.md). Copy-paste shapes; load this file when writing a plan, not on every activation. The adapter's `## plan` field **Templates** (default: none) adds the repository's header fields, compliance items, machine-state shape, and handoff record.

## Plan

```markdown
# <Feature Name> Plan

**Feature Slug**: `feature-slug`
**Status**: ACTIVE | BLOCKED | IMPLEMENTED | SUPERSEDED
**Supersedes**: <old plan, if any>
**Created**: YYYY-MM-DD
**Last Updated**: YYYY-MM-DD
<header fields from Templates>

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | <choice made> | <why this over the alternatives> |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| User can X  | Step 3       | pending |

## Repository guidance compliance
- [ ] <each item from Templates>
- [ ] Quality bar applied; no speculative abstractions or mixed abstraction levels

## Impact Analysis
### Files to Modify
- `path/to/file` - what changes
### Files to Create
- `path/to/new-file`

## Test Strategy
- **Unit**: what gets tested, expected coverage change
- **Integration**: cross-package or workflow tests
- **End-to-end**: user-facing flows to verify

## Implementation Steps
### Step 1: <action>
**Files**: `path/to/file`
**Details**: the specific change

## Validation
- [ ] Types pass
- [ ] Tests pass
- [ ] Build succeeds

### Fresh Evidence Receipt
- **Tested implementation commit SHA**: `<full SHA>`
- **Run at (UTC)**: `YYYY-MM-DDTHH:MM:SSZ`
- **Command**: `<exact command>`
- **Result**: `<counts or a short output summary>`
- **Validated paths**: `<implementation, dependency, configuration, and validation paths>`
- **Worktree identity**: `git status --porcelain=v1 --untracked-files=all -- <validated paths>` → `<empty>`
- **Evidence-only diff (if applicable)**: `git diff --exit-code <tested>..HEAD -- <validated paths>` → `<result>`
- **Evidence-only worktree status (if applicable)**: `git status --porcelain=v1 --untracked-files=all -- <validated paths>` → `<empty>`
```

A filled decision log reads like this:

```markdown
| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Call the storage service directly | Standard interface; a proxy layer adds latency and no capability |
| 2 | Manual retry only in phase 1 | Simpler to build and debug |
```

## Batch report

Include the repository's handoff record (**Templates**) in batch and lane handoffs, and keep validation receipts beside their proof.

```markdown
## Batch [N] Complete

### Tasks Completed
1. Step 1: <description>
   - Files: `path/to/file`

### Next Batch Preview
- Steps 4, 5, 6

**Awaiting feedback before continuing...**
```

## Closeout section

Append to the plan when it closes (plan skill, Close a plan).

```markdown
**Status**: `CLOSED: shipped in PR #123; <the one thing a reader must know>`

## Closeout (YYYY-MM-DD)

Closed as `<resolution>`. Shipped in PR #123 (merged YYYY-MM-DD). <Why this resolution: which lanes or proofs were never certified, if any.>

Still open:
- <item> → <tracker issue | another plan | dropped because ...>
```
