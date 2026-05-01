# Vitest API Reference

Reference material for Vitest unit testing. See parent `SKILL.md` for TDD workflow and Green Goods patterns.

## Why Vitest

- **Vite-native**: Same transformation pipeline as your app
- **Fast HMR**: Tests rerun only on affected changes
- **Jest-compatible**: Familiar API
- **TypeScript native**: No extra config

## Core API

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

## Assertions

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

## Hooks

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

## Mocking

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
