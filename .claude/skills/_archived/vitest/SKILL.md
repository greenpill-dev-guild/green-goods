---
name: vitest
description: Fast unit testing framework powered by Vite. Use when writing tests, mocking, or configuring coverage.
---

# Vitest Skill

Next-generation testing framework powered by Vite with native ESM, TypeScript, and JSX support.

**Source**: [antfu/skills](https://github.com/antfu/skills)

---

## Why Vitest for Green Goods

- **Vite-native**: Uses same transformation pipeline as your app
- **Fast HMR**: Tests rerun only on affected changes
- **Jest-compatible**: Familiar API, easy migration
- **TypeScript native**: No extra config needed
- **Parallel execution**: Multi-threaded workers

---

## Core API

### Test Functions

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
  it.concurrent("runs in parallel", async () => {});
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

// Strings
expect(str).toMatch(/pattern/);
expect(str).toContain("substring");

// Arrays
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
import { beforeAll, beforeEach, afterEach, afterAll } from "vitest";

beforeAll(async () => {
  // Setup once before all tests
  await setupDatabase();
});

beforeEach(() => {
  // Reset before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(async () => {
  // Teardown after all tests
  await teardownDatabase();
});
```

---

## Mocking

### Functions

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
```

### Modules

```typescript
// Mock entire module
vi.mock("@green-goods/shared", () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
  useGardens: vi.fn(() => ({ data: mockGardens })),
}));

// Mock with factory
vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchGardens: vi.fn(),
  };
});

// Spy on existing method
const spy = vi.spyOn(object, "method");
```

### Timers

```typescript
// Enable fake timers
vi.useFakeTimers();

// Advance time
vi.advanceTimersByTime(1000);
vi.runAllTimers();

// Restore real timers
vi.useRealTimers();
```

---

## Configuration

```typescript
// vitest.config.ts (or in vite.config.ts)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,              // No imports needed for describe/it/expect
    environment: "jsdom",       // For React components
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "**/__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules", "test"],
    },
  },
});
```

---

## Green Goods Patterns

### Testing Hooks

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGardens } from "@green-goods/shared";

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

### Testing Components

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { GardenCard } from "@green-goods/shared";

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

### Using Mock Factories

```typescript
// packages/shared/src/__tests__/test-utils/mock-factories.ts
import { createMockGarden, createMockWork } from "./mock-factories";

test("work submission flow", () => {
  const garden = createMockGarden({ name: "Test Garden" });
  const work = createMockWork({ gardenAddress: garden.address });

  expect(work.gardenAddress).toBe(garden.address);
});
```

---

## Commands

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Run specific file
bun test garden.test.ts

# Run with coverage
bun test --coverage

# Run in UI mode
bun test --ui

# Filter by test name
bun test -t "should validate"
```

---

## Coverage Requirements

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
