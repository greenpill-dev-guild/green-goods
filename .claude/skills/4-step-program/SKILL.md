# The 4-Step Program Skill

Coordinator workflow for orchestrating agents through a fix-review-iterate-present loop.

## Activation

Use when:
- Coordinating complex multi-agent workflows
- Ensuring 10/10 quality before completion
- Managing fix-review cycles
- User requests systematic task execution

## Core Loop

```
┌─────────────────────────────────────────┐
│  1. DELEGATE FIX → Agent implements     │
│                    ↓                    │
│  2. REVIEW → Code-reviewer analyzes     │
│                    ↓                    │
│  3. CHECK → Is it 10/10?                │
│             ↓ No        ↓ Yes           │
│        Loop back    4. PRESENT          │
└─────────────────────────────────────────┘
```

### Step 1: Delegate Fix

Before delegation, MUST:

1. **Read full issue/task**
2. **Extract EVERY requirement**
3. **Include ALL requirements in prompt**

Delegation prompt template:

```markdown
## Task: [Description]

### Requirements (ALL must be implemented)
1. [Requirement 1]
2. [Requirement 2]
3. [Requirement 3]

### Context
- Related files: [list]
- Existing patterns: [describe]
- Constraints: [list]

### Green Goods Compliance
- Hooks in shared package only
- i18n for all UI strings
- No hardcoded addresses
- Conventional commits

### Deliverables
- [ ] Implementation complete
- [ ] Tests added
- [ ] Types strict
- [ ] Linting passes
```

### Step 2: Agent Performs Review

After implementation, dispatch code-reviewer agent:

```markdown
Review the changes from [commit-range].

Focus on:
- 100% requirement coverage
- Green Goods architecture compliance
- Code quality standards
```

**CRITICAL**: Review MUST be posted to GitHub PR.

### Step 3: Coordinator Checks

Check for 10/10 quality:

| Criteria | Required |
|----------|----------|
| All requirements implemented | Yes |
| Zero items in "Suggest Fixing" | Yes |
| Zero items in "Possible Simplifications" | Yes |
| All verification commands pass | Yes |
| Review posted to GitHub | Yes |

**Step 3.5: Coverage Verification**

Create requirements table:

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| User can X | `src/foo.ts:42` | DONE |
| API returns Y | `src/bar.ts:15` | DONE |
| Error shows Z | Missing | NOT DONE |

If coverage < 100%: **REJECT → Loop back to Step 1**

### Step 4: Present

Only when 10/10 achieved:

```markdown
## Task Complete

### Summary
[Brief description of what was implemented]

### Requirements Coverage
| Requirement | Status |
|-------------|--------|
| [All items] | DONE |

### PR
[PR #123](https://github.com/owner/repo/pull/123)

### Verification
- TypeScript: PASS
- Linting: PASS
- Tests: PASS
- Build: PASS

### Review
Posted to PR, all items addressed.
```

## Mandatory GitHub PR Posting

> Every code review MUST be posted to GitHub as a PR comment.
> This is NOT optional.

Why:
- Users need to see review before merge
- Creates audit trail
- Enables async collaboration

## URL Formatting

All PR/issue references MUST use clickable markdown:

```markdown
✅ [PR #243](https://github.com/owner/repo/pull/243)
✅ [Issue #123](https://github.com/owner/repo/issues/123)

❌ PR #243
❌ #123
```

## Quality Standards

### 10/10 Review Means

- All issue requirements implemented
- Zero "Suggest Fixing" items
- Zero "Possible Simplifications" items
- All commands executed and passing
- Review posted to GitHub

### Below 10/10

If any criteria not met:
1. Document what's missing
2. Return to Step 1
3. Re-implement missing parts
4. Re-review
5. Repeat until 10/10

## Green Goods Integration

When running 4-step for Green Goods:

1. **Verify hook location** in Step 3:
   ```bash
   bash .claude/scripts/validate-hook-location.sh
   ```

2. **Check i18n** in Step 3:
   ```bash
   node .claude/scripts/check-i18n-completeness.js
   ```

3. **Contract validation** (if applicable):
   ```bash
   cd packages/contracts && bun test
   ```

## Example Flow

```
User: "Implement garden metrics feature"

1. DELEGATE: Launch agent with all requirements
   → Agent implements feature

2. REVIEW: Dispatch code-reviewer
   → Reviews finds 2 issues

3. CHECK: Coverage 80%, not 10/10
   → Loop back

1. DELEGATE: Fix remaining issues
   → Agent fixes issues

2. REVIEW: Dispatch code-reviewer
   → Clean review

3. CHECK: Coverage 100%, all pass
   → Proceed

4. PRESENT: Show user final result
   → PR link, verification results
```

## Key Principles

- **100% coverage required** - Never accept partial
- **GitHub posting mandatory** - Reviews must be visible
- **Loop until 10/10** - Don't settle for less
- **Evidence-based** - Show proof of completion
