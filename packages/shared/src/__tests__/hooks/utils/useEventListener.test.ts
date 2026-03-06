/**
 * useEventListener Hook Tests
 * @vitest-environment jsdom
 *
 * Tests event listener attachment, cleanup, null target handling,
 * and the convenience wrappers (useWindowEvent, useDocumentEvent).
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useDocumentEvent,
  useEventListener,
  useWindowEvent,
} from "../../../hooks/utils/useEventListener";

// ============================================
// Helper: create a mock EventTarget
// ============================================

function createMockTarget() {
  const listeners = new Map<string, Set<EventListener>>();

  return {
    addEventListener: vi.fn((event: string, handler: EventListener) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: EventListener) => {
      listeners.get(event)?.delete(handler);
    }),
    dispatchEvent: (event: Event) => {
      const handlers = listeners.get(event.type);
      handlers?.forEach((h) => h(event));
    },
    getListenerCount: (event: string) => listeners.get(event)?.size ?? 0,
  };
}

// ============================================
// useEventListener
// ============================================

describe("useEventListener", () => {
  describe("attachment and cleanup", () => {
    it("attaches event listener on mount", () => {
      const target = createMockTarget();
      const handler = vi.fn();

      renderHook(() => useEventListener(target as any, "click" as any, handler));

      expect(target.addEventListener).toHaveBeenCalledOnce();
      expect(target.addEventListener.mock.calls[0][0]).toBe("click");
    });

    it("removes event listener on unmount", () => {
      const target = createMockTarget();
      const handler = vi.fn();

      const { unmount } = renderHook(() =>
        useEventListener(target as any, "click" as any, handler)
      );

      expect(target.addEventListener).toHaveBeenCalledOnce();

      unmount();

      expect(target.removeEventListener).toHaveBeenCalledOnce();
      expect(target.removeEventListener.mock.calls[0][0]).toBe("click");
    });

    it("calls handler when event fires", () => {
      const target = createMockTarget();
      const handler = vi.fn();

      renderHook(() => useEventListener(target as any, "click" as any, handler));

      const event = new Event("click");
      target.dispatchEvent(event);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(event);
    });

    it("does not call handler after unmount", () => {
      const target = createMockTarget();
      const handler = vi.fn();

      const { unmount } = renderHook(() =>
        useEventListener(target as any, "click" as any, handler)
      );

      unmount();

      target.dispatchEvent(new Event("click"));
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Null/undefined target
  // ------------------------------------------

  describe("null target handling", () => {
    it("does not attach listener when target is null", () => {
      const handler = vi.fn();

      // Should not throw
      renderHook(() => useEventListener(null, "click" as any, handler));
    });

    it("does not attach listener when target is undefined", () => {
      const handler = vi.fn();

      // Should not throw
      renderHook(() => useEventListener(undefined, "click" as any, handler));
    });
  });

  // ------------------------------------------
  // Handler ref update
  // ------------------------------------------

  describe("handler ref update", () => {
    it("always calls the latest handler", () => {
      const target = createMockTarget();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const { rerender } = renderHook(
        ({ handler }) => useEventListener(target as any, "click" as any, handler),
        { initialProps: { handler: handler1 } }
      );

      // Re-render with new handler
      rerender({ handler: handler2 });

      // Fire event
      target.dispatchEvent(new Event("click"));

      // Should call the latest handler
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  // ------------------------------------------
  // Re-attachment on target change
  // ------------------------------------------

  describe("target change", () => {
    it("re-attaches listener when target changes", () => {
      const target1 = createMockTarget();
      const target2 = createMockTarget();
      const handler = vi.fn();

      const { rerender } = renderHook(
        ({ target }) => useEventListener(target as any, "click" as any, handler),
        { initialProps: { target: target1 } }
      );

      // Change target
      rerender({ target: target2 });

      // Old target should have listener removed
      expect(target1.removeEventListener).toHaveBeenCalled();
      // New target should have listener added
      expect(target2.addEventListener).toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Options passthrough
  // ------------------------------------------

  describe("options", () => {
    it("passes capture option to addEventListener", () => {
      const target = createMockTarget();
      const handler = vi.fn();

      renderHook(() => useEventListener(target as any, "click" as any, handler, { capture: true }));

      const options = target.addEventListener.mock.calls[0][2];
      expect(options).toEqual(expect.objectContaining({ capture: true }));
    });

    it("passes once option to addEventListener", () => {
      const target = createMockTarget();
      const handler = vi.fn();

      renderHook(() => useEventListener(target as any, "click" as any, handler, { once: true }));

      const options = target.addEventListener.mock.calls[0][2];
      expect(options).toEqual(expect.objectContaining({ once: true }));
    });

    it("passes passive option to addEventListener", () => {
      const target = createMockTarget();
      const handler = vi.fn();

      renderHook(() =>
        useEventListener(target as any, "scroll" as any, handler, { passive: true })
      );

      const options = target.addEventListener.mock.calls[0][2];
      expect(options).toEqual(expect.objectContaining({ passive: true }));
    });
  });
});

// ============================================
// useWindowEvent
// ============================================

describe("useWindowEvent", () => {
  it("attaches listener to window", () => {
    const handler = vi.fn();
    const addSpy = vi.spyOn(window, "addEventListener");

    const { unmount } = renderHook(() => useWindowEvent("resize", handler));

    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function), undefined);

    unmount();
    addSpy.mockRestore();
  });

  it("removes listener on unmount", () => {
    const handler = vi.fn();
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useWindowEvent("resize", handler));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function), undefined);

    removeSpy.mockRestore();
  });
});

// ============================================
// useDocumentEvent
// ============================================

describe("useDocumentEvent", () => {
  it("attaches listener to document", () => {
    const handler = vi.fn();
    const addSpy = vi.spyOn(document, "addEventListener");

    const { unmount } = renderHook(() => useDocumentEvent("visibilitychange", handler));

    expect(addSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function), undefined);

    unmount();
    addSpy.mockRestore();
  });
});
