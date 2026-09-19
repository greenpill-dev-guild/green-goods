/**
 * useBeforeUnloadWhilePending Hook Tests
 *
 * Verifies that the beforeunload handler is:
 * 1. Registered when isPending is true
 * 2. Unregistered when isPending flips to false
 * 3. Not registered when isPending is initially false
 * 4. Properly cleaned up on unmount
 *
 * And that useSafeMutation only installs it for in-page signers: an external
 * wallet handoff is an expected departure, not unsaved work.
 */

import { renderHook } from "@testing-library/react";
import type { UseMutationResult } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthMode } from "../../../types/auth";
import { useBeforeUnloadWhilePending } from "../../../hooks/utils/useBeforeUnloadWhilePending";
import { useSafeMutation } from "../../../hooks/utils/useSafeMutation";

type AddEventListenerCall = Parameters<Window["addEventListener"]>;
type RemoveEventListenerCall = Parameters<Window["removeEventListener"]>;

// `undefined` models a mutation rendered outside AuthProvider.
let mockAuthMode: AuthMode | undefined = "passkey";

vi.mock("../../../providers/Auth", () => ({
  useOptionalAuthContext: () =>
    mockAuthMode === undefined ? undefined : { authMode: mockAuthMode },
}));

function beforeUnloadAdds(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter((call: AddEventListenerCall) => call[0] === "beforeunload");
}

function beforeUnloadRemoves(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter((call: RemoveEventListenerCall) => call[0] === "beforeunload");
}

function mutationWith(isPending: boolean) {
  return {
    isPending,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  } as unknown as UseMutationResult<unknown, Error, void, unknown>;
}

describe("hooks/utils/useBeforeUnloadWhilePending", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockAuthMode = "passkey";
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("does not register handler when isPending is false", () => {
    renderHook(() => useBeforeUnloadWhilePending(false));

    expect(beforeUnloadAdds(addSpy)).toHaveLength(0);
  });

  it("registers handler when isPending is true", () => {
    renderHook(() => useBeforeUnloadWhilePending(true));

    expect(beforeUnloadAdds(addSpy)).toHaveLength(1);
  });

  it("unregisters handler when isPending changes from true to false", () => {
    const { rerender } = renderHook(({ pending }) => useBeforeUnloadWhilePending(pending), {
      initialProps: { pending: true },
    });

    // Handler should be registered
    expect(beforeUnloadAdds(addSpy)).toHaveLength(1);

    // Switch to not pending
    rerender({ pending: false });

    // Handler should be removed
    expect(beforeUnloadRemoves(removeSpy)).toHaveLength(1);
  });

  it("cleans up handler on unmount while pending", () => {
    const { unmount } = renderHook(() => useBeforeUnloadWhilePending(true));

    unmount();

    expect(beforeUnloadRemoves(removeSpy)).toHaveLength(1);
  });

  it("handler calls preventDefault and sets returnValue", () => {
    renderHook(() => useBeforeUnloadWhilePending(true));

    const handler = beforeUnloadAdds(addSpy)[0]?.[1] as
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

  describe("useSafeMutation guard ownership", () => {
    it.each([
      "passkey",
      "embedded",
    ] as const)("keeps unload protection while an in-page %s signer is pending", (authMode) => {
      mockAuthMode = authMode;

      renderHook(() => useSafeMutation(mutationWith(true)));

      expect(beforeUnloadAdds(addSpy)).toHaveLength(1);
    });

    it("keeps unload protection when no auth context is mounted", () => {
      mockAuthMode = undefined;

      renderHook(() => useSafeMutation(mutationWith(true)));

      expect(beforeUnloadAdds(addSpy)).toHaveLength(1);
    });

    it("does not install the guard during an external wallet handoff", () => {
      mockAuthMode = "wallet";

      const { rerender, unmount } = renderHook(
        ({ pending }) => useSafeMutation(mutationWith(pending)),
        { initialProps: { pending: true } }
      );
      rerender({ pending: false });
      unmount();

      expect(beforeUnloadAdds(addSpy)).toHaveLength(0);
      expect(beforeUnloadRemoves(removeSpy)).toHaveLength(0);
    });

    it("leaves nothing behind when an in-page mutation settles", () => {
      mockAuthMode = "passkey";

      const { rerender } = renderHook(({ pending }) => useSafeMutation(mutationWith(pending)), {
        initialProps: { pending: true },
      });
      expect(beforeUnloadAdds(addSpy)).toHaveLength(1);

      rerender({ pending: false });

      expect(beforeUnloadRemoves(removeSpy)).toHaveLength(1);
    });

    it("does not install the guard for an idle mutation", () => {
      mockAuthMode = "passkey";

      renderHook(() => useSafeMutation(mutationWith(false)));

      expect(beforeUnloadAdds(addSpy)).toHaveLength(0);
    });
  });
});
