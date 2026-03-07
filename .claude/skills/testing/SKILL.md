---
name: testing
description: Testing patterns - TDD workflow, Vitest unit tests, Playwright E2E. Use for writing tests, implementing features, debugging.
---

# Testing Skill

Complete testing guide: TDD workflow, unit testing with Vitest, E2E testing with Playwright.

---

## Activation

When invoked:
- Decide the test type (unit/integration/E2E) based on impact and speed.
- Locate existing test utilities in `packages/shared/src/__tests__/test-utils/`.
- Prefer TDD for new behavior (RED → GREEN → REFACTOR).

## Part 1: Test-Driven Development (TDD)

### The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over. No exceptions.

### When to Use TDD

**Always:**
- New features
- Bug fixes
- Refactoring
- Behavior changes

**Exceptions (ask your human partner):**
- Throwaway prototypes
- Generated code
- Configuration files

### Red-Green-Refactor

#### RED - Write Failing Test

Write one minimal test showing what should happen:

```typescript
// Good: Clear name, tests real behavior, one thing
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

#### Verify RED - Watch It Fail

**MANDATORY. Never skip.**

```bash
bun run test -- path/to/test.test.ts
```

> **CRITICAL: `bun test` vs `bun run test`** — `bun test` invokes bun's built-in test runner which **ignores vitest config** (no jsdom, no aliases, no setup files). `bun run test` runs the package.json `"test"` script (vitest). **Always use `bun run test`** for vitest-based packages (shared, client, admin). To run a single test file: `bun run test -- path/to/test.test.ts`.

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

#### GREEN - Minimal Code

Write simplest code to pass the test:

```typescript
// Good: Just enough to pass
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
```

#### Verify GREEN - Watch It Pass

**MANDATORY.**

```bash
bun run test -- path/to/test.test.ts
```

#### REFACTOR - Clean Up

After green only: remove duplication, improve names, extract helpers.
Keep tests green. Don't add behavior.

### Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Already manually tested" | Ad-hoc != systematic. No record, can't re-run. |
| "TDD will slow me down" | TDD faster than debugging. |

### Bug Fix Workflow

```
1. Write failing test that reproduces the bug
2. Run test -> watch it fail (confirms bug exists)
3. Fix the bug with minimal code
4. Run test -> watch it pass
5. Test now prevents regression forever
```

**Never fix bugs without a test.**

---

## Part 2: Unit Testing with Vitest

See `references/vitest.md` for the full Vitest API reference (core API, assertions, hooks, mocking).

### Green Goods Patterns

#### Testing Hooks

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

test("useGardens fetches gardens", async () => {
  const { result } = renderHook(() => useGardens(11155111), { wrapper });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(result.current.data).toHaveLength(3);
});
```

#### Testing Components

```typescript
import { render, screen, fireEvent } from "@testing-library/react";

test("GardenCard displays garden name", () => {
  render(<GardenCard garden={mockGarden} />);
  expect(screen.getByText("Community Garden")).toBeInTheDocument();
});

test("GardenCard calls onSelect when clicked", async () => {
  const onSelect = vi.fn();
  render(<GardenCard garden={mockGarden} onSelect={onSelect} />);

  await fireEvent.click(screen.getByRole("button"));

  expect(onSelect).toHaveBeenCalledWith(mockGarden.address);
});
```

#### Using Mock Factories

```typescript
// packages/shared/src/__tests__/test-utils/mock-factories.ts
import { createMockGarden, createMockWork } from "./mock-factories";

test("work submission flow", () => {
  const garden = createMockGarden({ name: "Test Garden" });
  const work = createMockWork({ gardenAddress: garden.address });

  expect(work.gardenAddress).toBe(garden.address);
});
```

#### Testing Hook Cleanup (Rules 1-3)

Hooks that use timers, event listeners, or async effects must clean up on unmount. Verify cleanup to prevent memory leaks.

```typescript
// Rule 1: Timer cleanup — verify setTimeout/setInterval is cleared
test("useDelayedInvalidation clears timer on unmount", () => {
  vi.useFakeTimers();
  const callback = vi.fn();
  const { result, unmount } = renderHook(() => useDelayedInvalidation(callback, 3000));

  result.current(); // Schedule
  unmount();        // Unmount before timer fires
  vi.advanceTimersByTime(5000);

  expect(callback).not.toHaveBeenCalled();
  vi.useRealTimers();
});

// Rule 2: Event listener cleanup — verify removeEventListener on unmount
test("useEventListener removes listener on unmount", () => {
  const handler = vi.fn();
  const addSpy = vi.spyOn(window, "addEventListener");
  const removeSpy = vi.spyOn(window, "removeEventListener");

  const { unmount } = renderHook(() => useWindowEvent("resize", handler));

  expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  unmount();
  expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
});

// Rule 3: Async cleanup — verify isMounted guard prevents stale updates
test("useAsyncEffect skips state update after unmount", async () => {
  const setState = vi.fn();
  const { unmount } = renderHook(() =>
    useAsyncEffect(async ({ isMounted }) => {
      await new Promise((r) => setTimeout(r, 100));
      if (isMounted()) setState("data");
    }, [])
  );

  unmount(); // Unmount before async completes
  await vi.advanceTimersByTimeAsync(200);
  expect(setState).not.toHaveBeenCalled();
});
```

#### Testing Mutation Error Paths

Every mutation hook must test error handling. Verify that errors are logged, tracked, and surfaced to the user.

```typescript
test("mutation calls error handler on failure", async () => {
  // Arrange: mock the contract call to reject
  const mockError = new Error("Transaction reverted");
  vi.mocked(writeContract).mockRejectedValueOnce(mockError);

  const { result } = renderHook(() => useMutationHook(), { wrapper });

  // Act: trigger the mutation
  result.current.mutate(payload);

  // Assert: error is handled, not swallowed
  await waitFor(() => {
    expect(result.current.isError).toBe(true);
  });
  expect(mockLogger.error).toHaveBeenCalledWith(
    expect.stringContaining("failed"),
    expect.objectContaining({ error: mockError })
  );
});

// For components: verify toast/UI feedback on error
test("shows error toast on submission failure", async () => {
  vi.mocked(useSubmitWork).mockReturnValue({
    mutateAsync: vi.fn().mockRejectedValue(new Error("gas estimation failed")),
    isPending: false,
  });

  render(<SubmitButton />, { wrapper });
  await userEvent.click(screen.getByRole("button"));

  expect(screen.getByText(/transaction failed/i)).toBeInTheDocument();
});
```

#### Testing Offline Scenarios

Client uses IndexedDB + job queue for offline operation. Test offline paths with mock network state and fake-indexeddb.

```typescript
import "fake-indexeddb/auto";
import { useJobQueue, JobKind } from "@green-goods/shared";

test("queues work submission when offline", async () => {
  // Simulate offline
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

  const { result } = renderHook(() => useJobQueue(), { wrapper });

  await act(async () => {
    await result.current.addJob({
      kind: JobKind.WORK_SUBMISSION,
      payload: { gardenAddress: "0x123", actionUID: "uid-1" },
      maxRetries: 3,
    });
  });

  const jobs = result.current.getJobs({ status: "pending" });
  expect(jobs).toHaveLength(1);
  expect(jobs[0].kind).toBe(JobKind.WORK_SUBMISSION);
});

test("processes queued jobs when back online", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  // ... trigger sync, verify jobs transition to "completed"
});
```

#### Critical Paths for Shared Package

These paths require **80%+ coverage** with 100% for auth and crypto:

| Path | Files | Why Critical |
|------|-------|-------------|
| **Authentication** | `hooks/auth/useAuth.ts`, `hooks/auth/usePasskeyAuth.ts` | User identity, session management |
| **Job Queue** | `hooks/work/useJobQueue.ts`, `stores/jobQueueStore.ts` | Offline work submission pipeline |
| **Contract Errors** | `utils/errors/contract-errors.ts`, `utils/errors/mutation-error-handler.ts` | Error parsing and user feedback |
| **Garden Operations** | `hooks/garden/useGardens.ts`, `hooks/garden/useGardenMembers.ts` | Core domain CRUD |
| **Work Submission** | `hooks/work/useSubmitWork.ts`, `hooks/work/useWorkApproval.ts` | Primary user workflow |
| **Offline Sync** | `hooks/utils/useOfflineStatus.ts`, `modules/sync/` | Data integrity across network states |
| **Query Keys** | `hooks/query-keys.ts` | Cache correctness across all queries |
| **Role Management** | `hooks/roles/useRole.ts`, `hooks/roles/useHatsRole.ts` | Access control enforcement |

### Commands

```bash
bun run test                # Run all tests
bun run test --watch        # Watch mode
bun run test -- garden.test.ts # Run specific file
bun run test --coverage     # With coverage
bun run test --ui           # UI mode
bun run test -t "should validate" # Filter by name
```

### Coverage Requirements

| Package | Critical Paths | Overall |
|---------|----------------|---------|
| **Client** | 80%+ | 70%+ |
| **Admin** | 70%+ | 70%+ |
| **Shared** | 80%+ (auth/crypto: 100%) | 70%+ |
| **Contracts** | 100% (mainnet) | 80% (testnet) |

**Measuring coverage:**
```bash
bun run test --coverage          # Run with coverage
open coverage/index.html         # View HTML report
```

---

## Part 3: E2E Testing with Playwright

Keep E2E focused on critical user journeys. Use page objects, role-based selectors, and explicit waits.

See `.claude/skills/testing/references/playwright.md` for the full Playwright guide (pyramid, selectors, network mocking, a11y, debugging).

---

## Verification Checklist

Before marking work complete:

### TDD Requirements
- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

### Validation Commands
- [ ] Run `bun format && bun lint && bun run test` — no errors/warnings
- [ ] Package-specific: `cd packages/[pkg] && npx tsc --noEmit`

### Documentation & Communication
- [ ] Update relevant documentation when behavior changes
- [ ] Surface remaining risks, manual steps, or test gaps in handoff

### Coverage & Pass Thresholds
- [ ] Coverage meets package target (70-100% depending on criticality)
- [ ] For contracts: ≥80% test pass rate (testnet), 100% (mainnet)

Can't check all boxes? You skipped TDD. Start over.

## Anti-Patterns

- Writing implementation before a failing test is in place
- Keeping placeholder assertions (`expect(true).toBe(true)`)
- Ignoring cleanup tests for timers/listeners/async hooks
- Using brittle snapshots where behavioral assertions are required
- Declaring completion without running `bun run test`, `bun lint`, and build checks

## Related Skills

- `contracts` — Foundry test patterns (fuzz, invariant) for smart contracts
- `react` — React Testing Library patterns and component testing
- `tanstack-query` — Testing queries, mutations, and cache behavior
- `data-layer` — Testing offline scenarios, IndexedDB with fake-indexeddb, migrations and schema changes
- `storybook` — Interaction testing in Storybook (visual regression + play functions)
