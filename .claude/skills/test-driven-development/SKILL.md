# Test-Driven Development (TDD) Skill

Implement features and fixes using test-first methodology.

## Activation

Use when:
- Implementing new features
- Fixing bugs
- Refactoring code
- User requests TDD approach

## Core Principle

> If you didn't watch the test fail, you don't know if it tests the right thing.

Code written before tests must be deleted and reimplemented.

## The TDD Cycle

```
┌─────────────────────────────────────┐
│           RED                       │
│   Write failing test                │
│   Verify it fails                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│          GREEN                      │
│   Write minimal code to pass        │
│   No more than necessary            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         REFACTOR                    │
│   Clean up implementation           │
│   Keep tests green                  │
└──────────────┬──────────────────────┘
               │
               ▼
            [Repeat]
```

### Phase 1: RED - Write Failing Test

1. **Identify the behavior to test**
   - What should the code do?
   - What are the inputs/outputs?

2. **Write minimal test**
   ```typescript
   // packages/shared/src/__tests__/hooks/useNewFeature.test.ts
   import { renderHook } from "@testing-library/react";
   import { describe, it, expect } from "vitest";
   import { useNewFeature } from "../../hooks/useNewFeature";

   describe("useNewFeature", () => {
     it("should return initial state", () => {
       const { result } = renderHook(() => useNewFeature());
       expect(result.current.data).toBeUndefined();
       expect(result.current.isLoading).toBe(false);
     });
   });
   ```

3. **Run test and verify it FAILS**
   ```bash
   bun test useNewFeature
   ```

   **Critical**: You MUST see the test fail before proceeding.

### Phase 2: GREEN - Make Test Pass

1. **Write minimal implementation**
   ```typescript
   // packages/shared/src/hooks/useNewFeature.ts
   export function useNewFeature() {
     return {
       data: undefined,
       isLoading: false,
     };
   }
   ```

2. **Run test and verify it PASSES**
   ```bash
   bun test useNewFeature
   ```

3. **Only write enough code to pass**
   - No extra features
   - No "while I'm here" additions
   - No premature optimization

### Phase 3: REFACTOR - Clean Up

1. **Improve code quality**
   - Extract functions
   - Improve naming
   - Remove duplication

2. **Keep tests green**
   ```bash
   bun test useNewFeature
   ```

3. **Refactor tests too**
   - Remove duplication
   - Improve readability
   - Add missing edge cases

## Green Goods TDD Patterns

### Hook Testing

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe("useGarden", () => {
  it("should fetch garden data", async () => {
    const { result } = renderHook(
      () => useGarden("garden-id"),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.garden).toBeDefined();
  });
});
```

### Contract Testing

```solidity
// packages/contracts/test/Garden.t.sol
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/tokens/Garden.sol";

contract GardenTest is Test {
    Garden garden;

    function setUp() public {
        garden = new Garden();
    }

    function test_InitialState() public {
        assertEq(garden.name(), "Garden");
    }

    function testFuzz_Transfer(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount > 0);
        // Test transfer logic
    }
}
```

### Component Testing

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

describe("GardenCard", () => {
  it("should display garden name", () => {
    render(<GardenCard garden={mockGarden} />);
    expect(screen.getByText("Test Garden")).toBeInTheDocument();
  });

  it("should call onClick when clicked", () => {
    const onClick = vi.fn();
    render(<GardenCard garden={mockGarden} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(mockGarden.id);
  });
});
```

## Coverage Targets

| Package | Target |
|---------|--------|
| shared | 80%+ |
| client | 70%+ |
| admin | 70%+ |
| contracts | 100% (mainnet) |

Auth and encryption paths: **100% required**

## Common Rationalizations (Avoid These)

| Excuse | Reality |
|--------|---------|
| "I'll write tests after" | Tests that pass immediately prove nothing |
| "It's too simple to test" | Simple code can still break |
| "Manual testing is enough" | Not reproducible or automated |
| "I know it works" | Prove it with a test |

## TDD Checklist

- [ ] Test written BEFORE implementation
- [ ] Test fails initially (verified)
- [ ] Minimal code written to pass
- [ ] Test passes after implementation
- [ ] Code refactored while green
- [ ] Edge cases covered
- [ ] No skipped tests

## Bug Fix TDD

For bug fixes:

1. **Write test that reproduces bug**
   ```typescript
   it("should not crash with null input", () => {
     // This currently fails - reproduces the bug
     expect(() => processData(null)).not.toThrow();
   });
   ```

2. **Verify test fails**
   ```bash
   bun test processData
   # Expected: test fails (bug exists)
   ```

3. **Fix the bug**

4. **Verify test passes**
   ```bash
   bun test processData
   # Expected: test passes (bug fixed)
   ```

## Output

After TDD session:
1. Tests written and passing
2. Coverage report
3. Implementation complete
4. Refactoring done
