---
name: testing
description: Testing patterns - TDD workflow, Vitest unit tests, Playwright E2E, mock strategies, and coverage targets. Use when writing tests, setting up test infrastructure, following TDD, or diagnosing test failures.
version: "1.0.0"
status: active
packages: ["shared", "contracts", "client", "admin"]
dependencies: []
last_updated: "2026-02-19"
last_verified: "2026-02-19"
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

### Why Vitest

- **Vite-native**: Same transformation pipeline as your app
- **Fast HMR**: Tests rerun only on affected changes
- **Jest-compatible**: Familiar API
- **TypeScript native**: No extra config

### Core API

```typescript
import { describe, it, test, expect } from "vitest";

// Basic test
test("adds numbers", () => {
  expect(1 + 1).toBe(2);
});

// With describe grouping
describe("GardenService", () => {
  it("fetches gardens by chain", async () => {
    const gardens = await fetchGardens(11155111);
    expect(gardens).toHaveLength(3);
  });

  it.skip("skipped test", () => {});
  it.only("focused test", () => {});
});
```

### Assertions

```typescript
// Equality
expect(value).toBe(exact);           // === comparison
expect(value).toEqual(deep);         // Deep equality
expect(value).toMatchObject(partial); // Partial match

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeCloseTo(0.3, 5);   // Floating point

// Strings/Arrays
expect(str).toMatch(/pattern/);
expect(arr).toContain(item);
expect(arr).toHaveLength(3);

// Objects
expect(obj).toHaveProperty("key");
expect(obj).toMatchSnapshot();

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow("message");

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

### Hooks

```typescript
import { beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";

beforeAll(async () => {
  await setupDatabase();
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup
});

afterAll(async () => {
  await teardownDatabase();
});
```

### Mocking

```typescript
import { vi } from "vitest";

// Mock function
const mockFn = vi.fn();
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue(data);
mockFn.mockImplementation((x) => x * 2);

// Assertions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenCalledTimes(3);

// Mock module
vi.mock("@green-goods/shared", () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

// Spy on existing method
const spy = vi.spyOn(object, "method");

// Fake timers
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

### Green Goods Patterns

> For mock factories, hook testing, cleanup patterns, mutation error testing, and offline scenarios, see [vitest-patterns.md](./vitest-patterns.md)

**Key patterns summary:**
- **Hook testing**: Use `renderHook` + QueryClientProvider wrapper. Always `waitFor` async results.
- **Component testing**: Use `render` + `screen` queries. Prefer role-based selectors.
- **Mock factories**: Use `createMockGarden`, `createMockWork` etc. from `test-utils/mock-factories.ts`.
- **Cleanup testing (Rules 1-3)**: Verify timer cleanup, event listener removal, and isMounted guards on unmount.
- **Mutation errors**: Test both hook-level (`isError`) and component-level (toast/UI feedback) error paths.
- **Offline scenarios**: Use `fake-indexeddb/auto` + `vi.spyOn(navigator, "onLine", "get")` to simulate offline.

**Critical paths** requiring 80%+ coverage (100% for auth/crypto): authentication, job queue, contract errors, garden operations, work submission, offline sync, query keys, role management.

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
