/**
 * useBeforeUnloadWhilePending Hook Tests
 *
 * Verifies that the beforeunload handler is:
 * 1. Registered when isPending is true
 * 2. Unregistered when isPending flips to false
 * 3. Not registered when isPending is initially false
 * 4. Properly cleaned up on unmount
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBeforeUnloadWhilePending } from "../../../hooks/utils/useBeforeUnloadWhilePending";

describe("hooks/utils/useBeforeUnloadWhilePending", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("does not register handler when isPending is false", () => {
    renderHook(() => useBeforeUnloadWhilePending(false));

    const beforeUnloadCalls = addSpy.mock.calls.filter(([event]) => event === "beforeunload");
    expect(beforeUnloadCalls).toHaveLength(0);
  });

  it("registers handler when isPending is true", () => {
    renderHook(() => useBeforeUnloadWhilePending(true));

    const beforeUnloadCalls = addSpy.mock.calls.filter(([event]) => event === "beforeunload");
    expect(beforeUnloadCalls).toHaveLength(1);
  });

  it("unregisters handler when isPending changes from true to false", () => {
    const { rerender } = renderHook(({ pending }) => useBeforeUnloadWhilePending(pending), {
      initialProps: { pending: true },
    });

    // Handler should be registered
    const addCalls = addSpy.mock.calls.filter(([event]) => event === "beforeunload");
    expect(addCalls).toHaveLength(1);

    // Switch to not pending
    rerender({ pending: false });

    // Handler should be removed
    const removeCalls = removeSpy.mock.calls.filter(([event]) => event === "beforeunload");
    expect(removeCalls).toHaveLength(1);
  });

  it("cleans up handler on unmount while pending", () => {
    const { unmount } = renderHook(() => useBeforeUnloadWhilePending(true));

    unmount();

    const removeCalls = removeSpy.mock.calls.filter(([event]) => event === "beforeunload");
    expect(removeCalls).toHaveLength(1);
  });

  it("handler calls preventDefault and sets returnValue", () => {
    renderHook(() => useBeforeUnloadWhilePending(true));

    const handler = addSpy.mock.calls.find(([event]) => event === "beforeunload")?.[1] as
      | ((e: BeforeUnloadEvent) => void)
      | undefined;
    expect(handler).toBeDefined();

    // Create a mock BeforeUnloadEvent
    const mockEvent = {
      preventDefault: vi.fn(),
      returnValue: undefined as string | undefined,
    } as unknown as BeforeUnloadEvent;

    handler!(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.returnValue).toBe("");
  });
});
