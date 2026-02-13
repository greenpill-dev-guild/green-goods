---
name: tdd-bugfix
description: Test-driven autonomous bug fix loops. Use for systematic bug fixes with regression test creation.
version: "1.0"
last_updated: "2026-02-11"
last_verified: "2026-02-11"
status: established
packages: [shared, client, admin, contracts, indexer]
dependencies: [debug, testing]
---

# TDD Bugfix Skill

Autonomous test-driven bug fix loop: reproduce with failing test, find root cause, fix, verify full suite, commit. No intermediate questions — run the full loop autonomously.

**References**: See `debug` skill for root cause investigation. See `testing` skill for TDD patterns.

---

## Activation

| Trigger | Action |
|---------|--------|
| "tdd bugfix" | Start autonomous bug fix loop |
| "fix this bug with tests" | Same |
| "reproduce and fix" | Same |
| Bug report provided | Start the loop |

## Progress Tracking (REQUIRED)

Every bugfix MUST use **TodoWrite**. See `CLAUDE.md` → Session Continuity.

---

## Part 1: The Autonomous Loop

```
REPRODUCE → ROOT CAUSE → FIX → REGRESSION CHECK → VERIFY → COMMIT
    │           │          │          │               │         │
    │           │          │          │               │         └─ fix(scope): description
    │           │          │          │               └─ bun run test + lint + build
    │           │          │          └─ Full test suite passes
    │           │          └─ Minimal code change
    │           └─ Document why the test fails
    └─ Write failing test that reproduces the bug
```

### Step 1: Reproduce

Write a focused test that fails in exactly the way described in the bug report.

**For TypeScript packages (shared, client, admin):**
```typescript
// packages/shared/src/__tests__/hooks/useAffectedHook.test.ts
import { describe, it, expect, vi } from "vitest";

describe("Bug: [description from report]", () => {
  it("should [expected behavior] but instead [actual behavior]", () => {
    // Setup: recreate the conditions described in the bug
    const input = /* ... */;

    // Act: trigger the buggy behavior
    const result = /* ... */;

    // Assert: what SHOULD happen (this will FAIL)
    expect(result).toBe(/* expected value */);
  });
});
```

**For contracts (Foundry):**
```solidity
// packages/contracts/test/regression/BugDescription.t.sol
function test_regression_bugDescription() public {
    // Setup: recreate conditions
    // Act: trigger buggy behavior
    // Assert: expected behavior (will FAIL)
}
```

**Run the test to confirm it fails:**
```bash
# TypeScript — CRITICAL: use `bun run test`, not `bun test`
cd packages/shared && bun run test -- __tests__/hooks/useAffectedHook.test.ts

# Contracts
cd packages/contracts && forge test --match-test "test_regression_bugDescription" -vvv
```

**Confirm:**
- [ ] Test fails (not errors — it runs but assertion fails)
- [ ] Failure message describes the actual bug behavior
- [ ] Test reproduces the bug consistently

### Step 2: Root Cause

Analyze WHY the test fails. Document the root cause as a code comment in the test file.

```typescript
describe("Bug: Garden metrics return NaN when no work submitted", () => {
  // ROOT CAUSE: calculateMetrics divides totalApproved by totalSubmitted,
  // but totalSubmitted is 0 when no work exists, causing NaN.
  // Fix: Add zero-division guard in calculateMetrics.
  it("should return 0 completion rate when no work submitted", () => {
    const metrics = calculateGardenMetrics({ works: [] });
    expect(metrics.completionRate).toBe(0); // Currently returns NaN
  });
});
```

**Root cause investigation approach:**
1. Read the source code that the test exercises
2. Trace the data flow from input to the failing assertion
3. Identify the exact line where behavior diverges from expected
4. Document the root cause in the test file

### Step 3: Fix

Implement the minimal fix to make the test pass.

**Rules:**
- Change as few lines as possible
- Don't refactor surrounding code
- Don't fix other issues you notice (create separate todos)
- Follow all 13 architectural rules

```typescript
// Before: Division by zero
const completionRate = totalApproved / totalSubmitted;

// After: Zero-division guard
const completionRate = totalSubmitted > 0 ? totalApproved / totalSubmitted : 0;
```

**Run the reproduction test to confirm it passes:**
```bash
cd packages/shared && bun run test -- __tests__/hooks/useAffectedHook.test.ts
```

### Step 4: Regression Check

Run the FULL test suite to catch any regressions from the fix.

```bash
# TypeScript packages
bun run test

# Contracts (if contract change)
cd packages/contracts && bun run test
```

**If regressions found:**
1. Diagnose whether YOUR fix caused the regression
2. If yes: adjust the fix (don't break existing behavior)
3. If no: the regression existed before — note it and continue
4. Re-run until green
5. Max 3 attempts at the same regression (Three-Strike Protocol)

### Step 5: Verify

Run full validation:

```bash
bun format && bun lint && bun run test && bun build
```

**Additional type checking:**
```bash
cd packages/shared && bunx tsc --noEmit
cd packages/client && bunx tsc --noEmit
cd packages/admin && bunx tsc --noEmit
```

### Step 6: Commit

Create a commit that includes BOTH the regression test and the fix:

```bash
git add packages/shared/src/__tests__/hooks/useAffectedHook.test.ts
git add packages/shared/src/hooks/garden/useGardenMetrics.ts
git commit -m "fix(shared): guard against zero-division in garden metrics

The calculateGardenMetrics function returned NaN when no work was
submitted because it divided by zero. Added a guard to return 0
when totalSubmitted is 0.

Includes regression test to prevent recurrence."
```

---

## Part 2: Dead End Protocol

If you hit a dead end after 3 attempts at the same error:

```markdown
## TDD Bugfix — Dead End Report

### Bug
[Original bug description]

### What Was Tried
1. **Attempt 1**: [approach] — failed because [reason]
2. **Attempt 2**: [approach] — failed because [reason]
3. **Attempt 3**: [approach] — failed because [reason]

### Root Cause Analysis
[What we know about the root cause]

### Blocking Issue
[What's preventing the fix]

### Recommended Next Steps
- [ ] [Specific action item]
- [ ] [Specific action item]
```

**Stop and report.** Don't brute-force past the Three-Strike Protocol.

---

## Part 3: Headless Mode

### Full Autonomous Bug Fix

```bash
claude -p "Bug report: [DESCRIBE BUG HERE]

Follow this autonomous loop — do not ask me anything until all steps complete:

1. Reproduce: Read relevant source files. Write a focused test (Forge test for contracts, Vitest for TypeScript) that fails in exactly the way described. Run it to confirm it fails.
2. Root cause: Analyze why the test fails. Document root cause as a code comment in the test file.
3. Fix: Implement the minimal fix. Run the new test to confirm it passes.
4. Regression check: Run the FULL test suite (bun run test for packages, forge test for contracts). If anything fails, diagnose and iterate until green.
5. Verify: Run bun format && bun lint && bun run test && bun build. Fix any issues.
6. Commit: Create a commit with format fix(scope): description that includes both the regression test and the fix.

If you hit a dead end after 3 attempts at the same error, document what you tried and stop." --allowedTools "Read,Bash,Grep,Glob,Edit,Write,TodoWrite"
```

### Reproduce-Only (No Fix)

```bash
claude -p "Bug report: [DESCRIBE BUG HERE]

Write a focused reproduction test only. Do NOT fix the bug — just:
1. Read the relevant source code
2. Write a minimal test that reproduces the bug
3. Run the test to confirm it fails
4. Document the root cause in a comment

Output the test file path and root cause analysis." --allowedTools "Read,Bash,Grep,Glob,Edit,Write,TodoWrite"
```

---

## Part 4: Package-Specific Patterns

### Shared/Client/Admin (Vitest)

```bash
# Run specific test file
cd packages/shared && bun run test -- __tests__/hooks/useAffected.test.ts

# Run with verbose output
cd packages/shared && bun run test -- __tests__/hooks/useAffected.test.ts --reporter=verbose

# Run matching test name
cd packages/shared && bun run test -- -t "should handle zero division"
```

### Contracts (Foundry)

```bash
# Run specific test with traces
cd packages/contracts && forge test --match-test "test_regression_" -vvvv

# Run with gas reporting
cd packages/contracts && forge test --match-test "test_regression_" --gas-report

# Fuzz test for edge cases
cd packages/contracts && forge test --match-test "testFuzz_" -vv
```

### Using Mock Factories

```typescript
import {
  createMockGarden,
  createMockWork,
  createMockAction,
} from "../test-utils/mock-factories";

// Override only what's relevant to the bug
const garden = createMockGarden({ name: "Bug Garden" });
const work = createMockWork({
  gardenAddress: garden.address,
  status: "pending", // The specific state that triggers the bug
});
```

---

## Anti-Patterns

- **Fixing before reproducing** — ALWAYS write the failing test first. No exceptions.
- **Skipping the RED step** — If you can't make a test fail, you don't understand the bug
- **Fixing more than the bug** — Don't refactor, don't fix nearby issues, don't improve style
- **Using `bun test` instead of `bun run test`** — `bun test` bypasses vitest config
- **Giant test files** — One test per bug, focused on the specific failure
- **Swallowing the root cause** — Always document WHY, not just WHAT
- **Continuing past 3 strikes** — Stop, document, and escalate

## Related Skills

- `debug` — Root cause investigation methodology
- `testing` — TDD workflow, Vitest patterns, mock factories
- `error-handling-patterns` — Error categorization for diagnosis
- `contracts` — Foundry test patterns for contract bugs
- `autonomous-review` — Full review→fix→verify pipeline
