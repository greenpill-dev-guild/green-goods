---
name: review
description: Code Review & PR Creation - 6-pass systematic review covering correctness, security, performance, patterns, testing, and documentation. Use when reviewing a PR, auditing code changes, or the user asks for systematic code quality analysis.
argument-hint: "[file-or-PR]"
version: "1.0.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-03-18"
last_verified: "2026-02-19"
---

# Review Skill

Code review workflow: request reviews, perform 6-pass analysis, process feedback.

**References**: See `CLAUDE.md` for codebase patterns and conventions. Use `code-reviewer` agent for PRs.
Canonical output contract: `.claude/standards/output-contracts.md`.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/review` | Perform 6-pass code review |
| `/review --mode verify_only --scope cross-package` | Cross-package verification pass |
| `/review --mode apply_fixes` | Explicit review-and-fix pass |
| `/review --iterate` | Review, fix, re-review loop until clean |
| After implementation | Request review |
| PR feedback received | Process and respond |

## Progress Tracking (REQUIRED)

Use **TodoWrite** when available. If unavailable, keep a Markdown checklist in the response. See `CLAUDE.md` → Session Continuity.

## Modes

- **Default mode**: `report_only`
- **Fix mode**: switch to `apply_fixes` only when explicitly requested (for example: `"apply fixes"`)

---

## Part 1: Perform Code Review (6-Pass Protocol)

> YOU DO NOT LET THINGS SLIP. YOU DESIRE ONLY PERFECTION.

### Pass 0: Change Explanation
- Document what changed and why in plain language
- Create Mermaid diagram showing component/data flow impact
- Identify the blast radius: which packages, hooks, types are affected

**What to look for:**
- Can you explain the change in one sentence? If not, the PR may be too large
- Does the PR description match what the code actually does?
- Are there unrelated changes mixed in?


### Pass 0.5: Issue Coverage (MANDATORY)

- Map every requirement from the issue/task to implementation
- **If coverage < 100%: STOP. Request changes.**

**What to look for:**
- Each acceptance criterion has a corresponding code change
- Edge cases mentioned in the issue are handled
- No scope creep — changes beyond the issue are flagged

**Example comment:**

```markdown
> **Issue Coverage: 2/3 (67%) — BLOCKING**
> - ✅ Requirement 1: "Users can submit work offline" → `useJobQueue.addJob()` in `SubmitWork.tsx:45`
> - ✅ Requirement 2: "Show sync status" → `SyncIndicator` component added
> - ❌ Requirement 3: "Retry failed submissions" → No retry UI found. Job queue retries automatically but user has no manual retry button.
```


### Pass 1: Technical Issues

- Type errors, null handling, missing error handling
- API contract violations, race conditions
- Stale closures, memory leaks, async cleanup

**What to look for:**

| Issue | Severity | Example |
|-------|----------|---------|
| Unhandled promise rejection | Critical | `await foo()` without try/catch in mutation |
| Missing null check | High | `garden.actions.map()` when garden could be undefined |
| Race condition | Critical | Async effect without isMounted guard (Rule #3) |
| Type assertion bypass | High | `as any` without documented reason |
| Missing error boundary | Medium | New route without ErrorBoundary wrapper |

**Example comment:**

```markdown
> **Critical: Race condition in useGardenData (line 34)**
> `useEffect` fetches async data without an isMounted guard. If the component unmounts before the fetch completes, this will attempt to set state on an unmounted component.
> **Fix:** Use `useAsyncEffect` from `@green-goods/shared` (Architectural Rule #3).
```


### Pass 2: Code Consistency

- Follows codebase style and existing patterns
- Dead code, duplicate logic, naming conventions
- Import patterns (barrel imports only — Rule #11)

**What to look for:**

| Issue | Severity | Example |
|-------|----------|---------|
| Deep import path | Medium | `from "@green-goods/shared/hooks/auth/useAuth"` |
| Inconsistent naming | Low | `handleClick` vs `onClick` vs `onPress` |
| Dead code | Medium | Commented-out code, unused variables |
| Duplicate logic | Medium | Re-implementing a pattern that exists in shared |
| Console.log in production | Medium | `console.log("debug")` left in (Rule #12) |

**Example comment:**

```markdown
> **Medium: Deep import bypasses barrel export (line 12)**
> `import { useAuth } from "@green-goods/shared/hooks/auth/useAuth"` should be `import { useAuth } from "@green-goods/shared"` (Architectural Rule #11).
```

### Pass 3: Architecture

- Hooks in shared package only (see CLAUDE.md)
- No hardcoded addresses — use deployment artifacts
- Proper abstractions, single responsibility
- Provider nesting order (Rule #13)
- Zustand selector granularity (Rule #6)

**What to look for:**

| Issue | Severity | Example |
|-------|----------|---------|
| Hook defined outside shared | Critical | `useLocalHook()` in client package |
| Hardcoded address | Critical | `const TOKEN = "0x1234..."` |
| Wrong provider order | Critical | `AuthProvider` outside `AppKitProvider` |
| Entire store selected | High | `useStore(state => state)` (Rule #6) |
| Chained useMemo | Medium | `useMemo` depending on another useMemo output (Rule #9) |

**Example comment:**

```markdown
> **Critical: Hook defined in client package (line 8)**
> `useGardenFilter()` is defined in `packages/client/src/hooks/`. ALL hooks MUST live in `@green-goods/shared` (CLAUDE.md Hook Boundary). Move to `packages/shared/src/hooks/garden/`.
```

### Pass 4: Environment Compatibility

- No package-specific .env files
- Platform compatibility (mobile Safari, offline)
- Offline behavior for any write operations
- Service worker impact

**What to look for:**

| Issue | Severity | Example |
|-------|----------|---------|
| Package-specific .env | Critical | `.env` file in `packages/client/` |
| Direct contract call from UI | High | `writeContract()` without job queue |
| Missing offline fallback | High | Feature breaks when offline |
| Browser API without feature detection | Medium | Using API without checking availability |

### Pass 5: Verification Strategy

```bash
# Full workspace verification
bun format && bun lint && bun run test && bun build

# For contract-touching PRs, also run production readiness
bun run verify:contracts       # Full: build → lint → tests → E2E → dry runs
bun run verify:contracts:fast  # Quick: skip E2E and dry runs
```

**What to verify:**
- All existing tests still pass
- New behavior has test coverage
- No TypeScript errors introduced
- Build succeeds for affected packages
- Bundle size within budget (< 150KB main, < 50KB per route)

### Pass 6: Synthesis

- **APPROVE** or **REQUEST CHANGES**
- Summarize all findings by severity
- Provide actionable next steps

---

## Part 2: Review Output

```markdown
## Code Review: [PR Title]

### Summary
[Scope + change explanation + requirement coverage]

### Severity Mapping
- `Critical|High -> must-fix`
- `Medium -> should-fix`
- `Low -> nice-to-have`

### Must-Fix
- [Issue] - `file.ts:123` — [Critical/High finding]

### Should-Fix
- [Issue] - `file.ts:456` — [Medium finding]

### Nice-to-Have
- [Suggestion] - `file.ts:789` — [Low finding]

### Verification
`bun run test`  
`bun lint`  
`bun build`

### Recommendation
**[APPROVE / REQUEST_CHANGES]**
[Brief rationale]
```

### Severity Guide

| Severity | Meaning | Action |
|----------|---------|--------|
| **Critical** | Breaks functionality, security issue, architectural violation | Must fix before merge |
| **High** | Performance issue, missing error handling, type safety gap | Should fix before merge |
| **Medium** | Style inconsistency, minor optimization, missing test | Fix in this PR or create follow-up issue |
| **Low** | Suggestion, nitpick, alternative approach | Author's discretion |

### Severity Mapping

| Review Severity | Action Bucket |
|----------------|---------------|
| Critical | must-fix |
| High | must-fix |
| Medium | should-fix |
| Low | nice-to-have |

### Post to GitHub

```bash
gh pr comment [PR_NUMBER] --body "[review content]"
```

Only post when PR context exists. For working-copy reviews, return findings in chat.

---

## Part 3: Request Review

```bash
# Prepare
git log main..HEAD --oneline
bun build && bun run test && bun lint

# Create PR
gh pr create --title "feat(scope): description" --body "..."
```

---

## Part 4: Process Feedback

### Evaluation

1. Read completely — don't react to individual points
2. Verify against codebase
3. Respond appropriately

### Response Types

| Situation | Response |
|-----------|----------|
| Valid | "Implementing as suggested" |
| Unclear | "Which specific line should be addressed?" |
| Incorrect | "This conflicts with X because..." |

### When to Push Back

- Breaks existing functionality
- Lacks codebase context
- Violates YAGNI
- Violates Green Goods conventions (see CLAUDE.md)

---

## Part 5: Iterate Mode

When `--iterate` is passed, the review runs in a continuous improvement loop:

1. Run full 6-pass review (Parts 1-4)
2. Present findings grouped by severity
3. Apply all must-fix and should-fix changes
4. Re-review ONLY the modified files (scoped 6-pass)
5. Repeat until:
   - No must-fix findings remain, OR
   - 3 iterations completed (safety limit), OR
   - User interrupts

### Iterate Mode Output

Each iteration produces a delta report:
- **Iteration N**: files changed, findings resolved, new findings introduced
- **Final**: cumulative summary with APPROVE or REQUEST_CHANGES

### When to Use Iterate vs Apply-Fixes

| Mode | Use When |
|------|----------|
| `--iterate` | You want hands-off fix-and-verify cycling |
| `--mode apply_fixes` | You want a single fix pass with manual re-review |
| Default (report only) | You want findings without any file changes |

---

## Reference Files

- **[apply-fixes.md](./apply-fixes.md)** -- Apply fixes mode: review-then-fix workflow with safety rules
- **[cross-package-verify.md](./cross-package-verify.md)** -- Cross-package verification: dependency-order checks across all packages

## Anti-Patterns

- **Rubber-stamp approvals** — Every PR gets the full 6-pass treatment; never approve without reading every changed line
- **Reviewing only the diff** — Context matters; read surrounding code to understand if the change fits
- **Severity inflation** — Not everything is critical; reserve "Critical" for actual blockers
- **Ignoring test coverage** — New behavior without tests is incomplete, even if the code is correct
- **Reviewing > 800 LOC at once** — Ask the author to split; large PRs hide bugs
- **Commenting without suggestions** — "This is wrong" is not actionable; "Use X instead because Y" is

## Final Gates

- **ANY COVERAGE < 100%** → DO NOT APPROVE
- **ANY UNRESOLVED CRITICAL/HIGH** → DO NOT APPROVE
- **POST TO GITHUB ONLY IN PR CONTEXT**

## Related Skills

- `architecture` — Architectural review in Pass 3
- `testing` — Test coverage verification in Pass 5
- `ui` (mermaid sub-file) — Change impact diagrams in Pass 0
- `ui` (compliance sub-file) — Accessibility review (add as Pass 4.5 for UI changes)
- `contracts` (security sub-file) — Security review for contract-touching PRs
- `ops` (git-workflow sub-file) — PR size guidelines and commit format validation
