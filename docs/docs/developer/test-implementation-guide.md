# Test Implementation Guide

**How to implement the test stubs created during refactoring**

## Quick Start

We've created 7 test stub files with 69 documented test cases. 6 example tests have been implemented to show the pattern.

### ✅ Implemented Examples (6 tests passing)

```bash
cd packages/client
bun test src/__tests__/components/GardenCard.test.tsx
bun test src/__tests__/components/ActionCard.test.tsx
```

**Results:** 6 passing, 14 TODO remaining

---

## Implementation Pattern

### Step 1: Import Test Utilities

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
// Import mock factories from shared package
import { createMockGarden } from "../../../../shared/src/__tests__/test-utils/mock-factories";
```

**Note:** Test utilities are in `shared/src/__tests__/test-utils/` but not exported from main package index.

### Step 2: Create Mock Data

```typescript
describe("GardenCard", () => {
  const mockGarden = createMockGarden({
    name: "Test Garden",
    description: "A beautiful test garden",
    location: "Test City",
    gardeners: ["0x123", "0x456"],
    operators: ["0x789"],
  });
  
  // ... tests
});
```

### Step 3: Implement Tests Progressively

**Phase 1: Data validation (no component needed)**
```typescript
it("should render garden name and description", () => {
  // Start with data validation
  expect(mockGarden.name).toBe("Test Garden");
  expect(mockGarden.description).toBe("A beautiful test garden");
  
  // TODO: Uncomment when component is available
  // const { getByText } = render(<GardenCard garden={mockGarden} />);
  // expect(getByText("Test Garden")).toBeInTheDocument();
});
```

**Phase 2: Component rendering (when component exists)**
```typescript
it("should render garden name and description", () => {
  const { getByText } = render(<GardenCard garden={mockGarden} />);
  expect(getByText("Test Garden")).toBeInTheDocument();
  expect(getByText("A beautiful test garden")).toBeInTheDocument();
});
```

---

## Available Mock Factories

### From `mock-factories.ts`

```typescript
// Domain entities
createMockGarden(overrides?)
createMockWork(overrides?)
createMockAction(overrides?)
createMockWorkDraft(overrides?)
createMockWorkApprovalDraft(overrides?)

// Auth & users
createMockAuthContext(options?)
createMockUserContext(options?)
createMockSmartAccountClient()
createMockP256Credential()

// Files
createMockFile(name?, type?, size?)
createMockFiles(count?)

// Constants
MOCK_ADDRESSES = { deployer, operator, gardener, smartAccount, garden, user }
MOCK_TX_HASH
```

### From `offline-helpers.ts`

```typescript
// Offline work
createMockOfflineWork(overrides?)
createMockConflict(workId, type?)
createMockStorageQuota(used?, total?)
createMockRetryState(attempts?, nextAttempt?)

// Network simulation
simulateNetworkConditions.offline()
simulateNetworkConditions.online()
simulateNetworkConditions.slow()

// Fetch mocking
mockFetch(response, ok?, status?)
mockFetchError(error)
mockFetchSequence(responses[])

// Utilities
waitFor(ms)
resetAllMocks()
```

---

## Test File Locations

### Client Package

```
packages/client/src/__tests__/
├── components/
│   ├── WorkDashboard.test.tsx    (10 test cases, 0 implemented)
│   ├── GardenCard.test.tsx       (10 test cases, 3 implemented ✅)
│   ├── ActionCard.test.tsx       (10 test cases, 3 implemented ✅)
│   └── OfflineIndicator.test.tsx (11 test cases, 0 implemented)
└── views/
    ├── Work.test.tsx             (13 test cases, 0 implemented)
    ├── Approvals.test.tsx        (12 test cases, 0 implemented)
    └── Garden.test.tsx           (13 test cases, 0 implemented)
```

**Total:** 69 test cases (6 implemented, 63 remaining)

---

## Implementation Priority

### High Priority (Core Components)
1. ✅ **GardenCard** - 3/10 implemented
2. ✅ **ActionCard** - 3/10 implemented  
3. **WorkDashboard** - 0/10 implemented (critical for offline flow)
4. **OfflineIndicator** - 0/11 implemented (critical for offline UX)

### Medium Priority (Views)
5. **Work submission view** - 0/13 implemented
6. **Approvals view** - 0/12 implemented

### Lower Priority
7. **Garden detail view** - 0/13 implemented

---

## Running Tests

### Run specific test file
```bash
cd packages/client
bun test src/__tests__/components/GardenCard.test.tsx
```

### Run all component tests
```bash
cd packages/client
bun test src/__tests__/components/
```

### Run all tests
```bash
cd packages/client
bun test
```

### Watch mode
```bash
cd packages/client
bun test --watch
```

---

## Common Patterns

### Testing with React Router
```typescript
import { MemoryRouter } from 'react-router-dom';

it("should navigate on click", () => {
  const { getByRole } = render(
    <MemoryRouter>
      <GardenCard garden={mockGarden} />
    </MemoryRouter>
  );
  
  const card = getByRole("button");
  fireEvent.click(card);
  // Assert navigation
});
```

### Testing with Providers
```typescript
import { createTestWrapper } from '../../../../shared/src/__tests__/test-utils';

it("should use auth context", () => {
  const wrapper = createTestWrapper();
  const { result } = renderHook(() => useAuth(), { wrapper });
  expect(result.current.isAuthenticated).toBe(false);
});
```

### Testing Async Operations
```typescript
import { waitFor } from '@testing-library/react';

it("should load data", async () => {
  const { getByText } = render(<Component />);
  
  await waitFor(() => {
    expect(getByText("Loaded")).toBeInTheDocument();
  });
});
```

### Testing User Interactions
```typescript
import { fireEvent } from '@testing-library/react';

it("should handle click", () => {
  const onClickMock = vi.fn();
  const { getByRole } = render(<Button onClick={onClickMock} />);
  
  fireEvent.click(getByRole("button"));
  expect(onClickMock).toHaveBeenCalledTimes(1);
});
```

---

## TDD Workflow

1. **Read the TODO test case**
2. **Write the test** (it will fail - red)
3. **Implement minimum code** to pass (green)
4. **Refactor** if needed
5. **Move to next test case**

---

## Example: Complete Test Implementation

```typescript
describe("GardenCard", () => {
  const mockGarden = createMockGarden({
    name: "Community Garden",
    description: "A vibrant space",
    location: "Downtown",
    gardeners: ["0x123", "0x456"],
    operators: ["0x789"],
  });

  it("should render garden name and description", () => {
    const { getByText } = render(<GardenCard garden={mockGarden} />);
    expect(getByText("Community Garden")).toBeInTheDocument();
    expect(getByText("A vibrant space")).toBeInTheDocument();
  });

  it("should display location", () => {
    const { getByText } = render(<GardenCard garden={mockGarden} />);
    expect(getByText(/Downtown/i)).toBeInTheDocument();
  });

  it("should show member counts", () => {
    const { getByText } = render(<GardenCard garden={mockGarden} />);
    expect(getByText(/2.*gardeners?/i)).toBeInTheDocument();
    expect(getByText(/1.*operators?/i)).toBeInTheDocument();
  });

  it("should navigate to detail on click", () => {
    const { getByRole } = render(
      <MemoryRouter>
        <GardenCard garden={mockGarden} />
      </MemoryRouter>
    );
    
    const card = getByRole("link");
    expect(card).toHaveAttribute("href", `/gardens/${mockGarden.id}`);
  });
});
```

---

## Next Steps

1. ✅ **6 example tests implemented** - Pattern established
2. **Implement WorkDashboard tests** - Critical for offline functionality
3. **Implement OfflineIndicator tests** - Critical for UX
4. **Implement remaining component tests** - GardenCard, ActionCard completion
5. **Implement view tests** - Work, Approvals, Garden
6. **Achieve 80%+ coverage** - Target for client package

---

## Resources

- Test stubs: `packages/client/src/__tests__/components/` and `views/`
- Mock factories: `packages/shared/src/__tests__/test-utils/mock-factories.ts`
- Offline helpers: `packages/shared/src/__tests__/test-utils/offline-helpers.ts`
- Base setup: `packages/shared/src/__tests__/setupTests.base.ts`
- Testing patterns: `packages/shared/.cursor/rules/testing-patterns.mdc`

---

**Happy Testing! 🧪**
