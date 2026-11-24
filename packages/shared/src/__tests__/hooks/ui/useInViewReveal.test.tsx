import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInViewReveal } from "../../../hooks/ui/useInViewReveal";

afterEach(() => vi.unstubAllGlobals());

function observe(options: Parameters<typeof useInViewReveal>[0] = {}) {
  let notify: IntersectionObserverCallback = () => {};
  const disconnect = vi.fn();
  const observed = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe = observed;
      disconnect = disconnect;
    }
  );
  const target = document.createElement("div");
  const hook = renderHook(() => {
    const state = useInViewReveal<HTMLDivElement>(options);
    state.ref.current = target;
    return state;
  });
  const intersect = (ratio: number, isIntersecting = true) =>
    act(() => {
      notify(
        [{ isIntersecting, intersectionRatio: ratio } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
  return { ...hook, intersect, disconnect, observed, target };
}

describe("viewport reveal", () => {
  it("waits for a positive configured threshold and stays admitted after leaving view", () => {
    const { result, intersect, observed, target } = observe({ threshold: 0.01 });
    expect(observed).toHaveBeenCalledWith(target);
    expect(result.current.revealed).toBe(false);
    intersect(0);
    expect(result.current.revealed).toBe(false);
    intersect(0.005);
    expect(result.current.revealed).toBe(false);
    intersect(0.02);
    expect(result.current.revealed).toBe(true);
    intersect(0, false);
    expect(result.current.revealed).toBe(true);
  });

  it("retains the existing zero-threshold reveal behavior", () => {
    const { result, intersect } = observe();
    intersect(0);
    expect(result.current.revealed).toBe(true);
  });

  it("updates both ways when once is disabled and disconnects on unmount", () => {
    const { result, intersect, unmount, disconnect } = observe({ threshold: 0.1, once: false });
    intersect(0.5);
    expect(result.current.revealed).toBe(true);
    intersect(0.05);
    expect(result.current.revealed).toBe(false);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("renders content when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const target = document.createElement("div");
    const { result } = renderHook(() => {
      const state = useInViewReveal<HTMLDivElement>();
      state.ref.current = target;
      return state;
    });
    expect(result.current.revealed).toBe(true);
  });
});
