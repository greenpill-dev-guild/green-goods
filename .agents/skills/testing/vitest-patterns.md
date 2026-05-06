# Vitest Patterns for Green Goods

> Back to [SKILL.md](./SKILL.md)

## Table of Contents

- [Testing Hooks](#testing-hooks)
- [Testing Components](#testing-components)
- [Mock Factories](#using-mock-factories)
- [Hook Cleanup Testing](#testing-hook-cleanup-rules-1-3)
- [Mutation Error Path Testing](#testing-mutation-error-paths)
- [Offline Scenario Testing](#testing-offline-scenarios)
- [Critical Paths for Shared Package](#critical-paths-for-shared-package)

---

## Testing Hooks

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

## Testing Components

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

## Using Mock Factories

```typescript
// packages/shared/src/__tests__/test-utils/mock-factories.ts
import { createMockGarden, createMockWork } from "./mock-factories";

test("work submission flow", () => {
  const garden = createMockGarden({ name: "Test Garden" });
  const work = createMockWork({ gardenAddress: garden.address });

  expect(work.gardenAddress).toBe(garden.address);
});
```

## Testing Hook Cleanup (Rules 1-3)

Hooks that use timers, event listeners, or async effects must clean up on unmount. Verify cleanup to prevent memory leaks.

### Rule 1: Timer cleanup -- verify setTimeout/setInterval is cleared

```typescript
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
```

### Rule 2: Event listener cleanup -- verify removeEventListener on unmount

```typescript
test("useEventListener removes listener on unmount", () => {
  const handler = vi.fn();
  const addSpy = vi.spyOn(window, "addEventListener");
  const removeSpy = vi.spyOn(window, "removeEventListener");

  const { unmount } = renderHook(() => useWindowEvent("resize", handler));

  expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  unmount();
  expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
});
```

### Rule 3: Async cleanup -- verify isMounted guard prevents stale updates

```typescript
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

## Testing Mutation Error Paths

Every mutation hook must test error handling. Verify that errors are logged, tracked, and surfaced to the user.

### Hook-level error testing

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
```

### Component-level error testing

```typescript
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

## Testing Offline Scenarios

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

## Critical Paths for Shared Package

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
