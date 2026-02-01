---
name: testing
description: Testing patterns - TDD workflow, Vitest unit tests, Playwright E2E. Use for writing tests, implementing features, debugging.
---

# Testing Skill

Complete testing guide: TDD workflow, unit testing with Vitest, E2E testing with Playwright.

---

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
bun test path/to/test.test.ts
```

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
bun test path/to/test.test.ts
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
    const gardens = await fetchGardens(84532);
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
  const { result } = renderHook(() => useGardens(84532), { wrapper });

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

### Commands

```bash
bun test                    # Run all tests
bun test --watch            # Watch mode
bun test garden.test.ts     # Run specific file
bun test --coverage         # With coverage
bun test --ui               # UI mode
bun test -t "should validate"  # Filter by name
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
bun test --coverage              # Run with coverage
open coverage/index.html         # View HTML report
```

---

## Part 3: E2E Testing with Playwright

### Testing Pyramid

```
        /-------\
       /  E2E   \    <- Few, critical paths only
      /-----------\
     / Integration \  <- More, component interactions
    /---------------\
   /      Unit       \ <- Many, fast, isolated
  /-------------------\
```

### What to Test with E2E

- Critical user journeys (login, work submission, approval)
- Complex interactions (multi-step forms)
- Cross-browser compatibility
- Authentication flows

### What NOT to Test with E2E

- Unit-level logic (use Vitest)
- API contracts (use integration tests)
- Edge cases (too slow)

### Page Object Model

```typescript
// e2e/pages/LoginPage.ts
import { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel("Email");
    this.submitButton = page.getByRole("button", { name: "Sign in" });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.page.getByLabel("Password").fill(password);
    await this.submitButton.click();
  }
}
```

### Waiting Strategies

```typescript
// Bad: Fixed timeout
await page.waitForTimeout(3000);

// Good: Wait for specific condition
await page.waitForLoadState("networkidle");
await page.waitForURL("/dashboard");
await expect(page.getByText("Welcome")).toBeVisible();

// Good: Wait for response
await page.waitForResponse((response) =>
  response.url().includes("/api/gardens") && response.status() === 200
);
```

### Selector Best Practices

```typescript
// Bad: Brittle selectors
page.locator(".btn.btn-primary.submit-button").click();

// Good: Role-based selectors
page.getByRole("button", { name: "Submit" }).click();
page.getByLabel("Email address").fill("user@example.com");

// Good: Test IDs when needed
page.getByTestId("photo-upload").setInputFiles(file);
```

### Network Mocking

```typescript
// Mock API response
await page.route("**/api/gardens", (route) => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ address: "0x123...", name: "Test Garden" }]),
  });
});

// Test error states
await page.route("**/api/work", (route) => {
  route.fulfill({
    status: 500,
    body: JSON.stringify({ error: "Internal Server Error" }),
  });
});
```

### Accessibility Testing

**E2E with Playwright + AxeBuilder:**

```typescript
import AxeBuilder from "@axe-core/playwright";

test("dashboard is accessible", async ({ page }) => {
  await page.goto("/dashboard");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

**Component-level with Storybook a11y addon:**

For component accessibility, use Storybook's built-in a11y addon:

1. Run Storybook: `cd packages/shared && bun run storybook`
2. Open component story
3. Check the "Accessibility" tab for violations

```typescript
// Example story with a11y checks
import type { Meta, StoryObj } from "@storybook/react";
import { GardenCard } from "./GardenCard";

const meta: Meta<typeof GardenCard> = {
  title: "Components/GardenCard",
  component: GardenCard,
  tags: ["autodocs"],
};

export default meta;
```

### Debugging

```bash
npx playwright test --headed     # Run in headed mode
npx playwright test --debug      # Debug mode (step through)
npx playwright test --ui         # UI mode (interactive)
npx playwright show-report       # Generate report
```

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
- [ ] Run `bun format && bun lint && bun test` — no errors/warnings
- [ ] Package-specific: `cd packages/[pkg] && npx tsc --noEmit`

### Documentation & Communication
- [ ] Update relevant documentation when behavior changes
- [ ] Surface remaining risks, manual steps, or test gaps in handoff

### Coverage & Pass Thresholds
- [ ] Coverage meets package target (70-100% depending on criticality)
- [ ] For contracts: ≥80% test pass rate (testnet), 100% (mainnet)

Can't check all boxes? You skipped TDD. Start over.
