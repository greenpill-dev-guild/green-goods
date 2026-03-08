---
name: reducing-entropy
description: Manual-only skill for minimizing total codebase size. Bias toward deletion.
---

# Reducing Entropy

More code begets more code. Entropy accumulates. This skill biases toward the smallest possible codebase.

**Core question:** "What does the codebase look like *after*?"

## The Goal

The goal is **less total code in the final codebase** - not less code to write right now.

- Writing 50 lines that delete 200 lines = net win
- Keeping 14 functions to avoid writing 2 = net loss
- "No churn" is not a goal. Less code is the goal.

**Measure the end state, not the effort.**

## Three Questions

### 1. What's the smallest codebase that solves this?

Not "what's the smallest change" - what's the smallest *result*.

- Could this be 2 functions instead of 14?
- Could this be 0 functions (delete the feature)?
- What would we delete if we did this?

### 2. Does the proposed change result in less total code?

Count lines before and after. If after > before, reject it.

- "Better organized" but more code = more entropy
- "More flexible" but more code = more entropy
- "Cleaner separation" but more code = more entropy

### 3. What can we delete?

Every change is an opportunity to delete. Ask:

- What does this make obsolete?
- What was only needed because of what we're replacing?
- What's the maximum we could remove?

## Red Flags

| Red Flag | Reality |
|----------|---------|
| "Keep what exists" | Status quo bias. The question is total code, not churn. |
| "This adds flexibility" | Flexibility for what? YAGNI. |
| "Better separation of concerns" | More files/functions = more code. Separation isn't free. |
| "Type safety" | Worth how many lines? Sometimes runtime checks win. |
| "Easier to understand" | 14 things are not easier than 2 things. |

## When This Doesn't Apply

- The codebase is already minimal for what it does
- You're in a framework with strong conventions (don't fight it)
- Regulatory/compliance requirements mandate certain structures

## Green Goods Application

### During Code Review (Audit)

Ask:
- Does this PR add more code than it removes?
- Could this be done with existing utilities?
- Is there dead code that can be deleted?

### During Implementation

Before adding code:
- Check if `@green-goods/shared` already has this utility
- Check if a simpler approach exists
- Consider if the feature is even needed

### Candidates for Deletion

Common sources of unnecessary code:
- Unused exports
- Over-abstracted utilities
- Defensive code for impossible states
- Duplicate implementations across packages
- Backwards-compatibility shims for removed features

## The Litmus Test

```
Before: X lines
After: Y lines

If Y > X → Question the change
If Y < X → Good direction
```

> **Note:** Line count is a heuristic, not absolute law. A 10% increase that removes three special cases may reduce cognitive complexity. Use judgment.

---

## Pre-Implementation Check (The Cathedral Test)

Before writing code, run this mental checklist. Hold the "cathedral" (system architecture) in mind while laying this "brick" (specific change).

### 1. What Cathedral Am I Building?

Identify the system-level design this change supports:

| Domain | Green Goods Cathedral | Key Pattern |
|--------|----------------------|-------------|
| **Offline sync** | Jobs queue for blockchain writes | `useJobQueue` with `JobKind` enum |
| **State management** | Zustand with granular selectors | Never `(s) => s`, always specific fields |
| **Server state** | TanStack Query with query keys | `queryKeys.gardens.list(chainId)` |
| **Auth** | Dual wallet/passkey system | `useAuth` from shared, never local |
| **Hooks location** | ALL hooks in `@green-goods/shared` | Never define hooks in client/admin |
| **Addresses** | From deployment artifacts | Never hardcode `0x...` |

**Ask**: "Which cathedral does this change belong to?"

### 2. Does This Brick Fit?

Find the most similar existing file and verify alignment:

| Check | Example Reference |
|-------|-------------------|
| Naming conventions | `useGardenMetrics` → `use[Domain][Action]` |
| Error handling | `createMutationErrorHandler()` pattern |
| State updates | `queryInvalidation.gardens(queryClient)` |
| Offline handling | `addJob({ kind: JobKind.WORK_SUBMISSION, ... })` |
| Import structure | `import { x } from '@green-goods/shared'` |

**Reference file**: [identify the closest existing implementation]

### 3. Hidden Global Costs?

Check for violations (see `.claude/rules/architectural-rules.md`):

| Rule | Check | Green Goods Example |
|------|-------|---------------------|
| **Rule 2** | Event listeners cleaned up? | Use `useEventListener()` or `{ once: true }` |
| **Rule 3** | Async has mount guard? | Use `useAsyncEffect()` with `isMounted()` |
| **Rule 7** | Query keys stable? | Use `queryKeys.x.y()` helpers, not inline objects |
| **Rule 9** | Chained useMemo? | Combine into single useMemo |
| **Rule 10** | Context value memoized? | Wrap provider value in useMemo |

**Additional Green Goods checks**:
- [ ] Will this create waterfall requests? (serial fetches in render)
- [ ] Does this break the offline-first guarantee?
- [ ] Is this duplicating logic that exists in `@green-goods/shared`?

### 4. Explain Non-Obvious Violations

When you spot a **non-obvious** architectural violation:
1. Explain the principle being violated (e.g., "This breaks referential equality because the query key object is recreated each render, causing infinite refetches...")
2. Then suggest the fix

*For obvious violations (missing cleanup, hardcoded addresses), the fix is self-explanatory.*

### Prioritization Statement

When trade-offs arise:
**Maintainability > Speed > Brevity**

Protect the existing architecture over shipping fast.

---

**Bias toward deletion. Measure the end state.**
