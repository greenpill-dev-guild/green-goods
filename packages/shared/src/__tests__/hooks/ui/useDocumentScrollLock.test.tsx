/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  useDocumentScrollLock,
  useDocumentScrollLockLifecycle,
} from "../../../hooks/ui/useDocumentScrollLock";

afterEach(() => {
  document.documentElement.classList.remove("modal-open");
});

describe("useDocumentScrollLock", () => {
  it("keeps the document locked until the final owner releases", () => {
    const first = renderHook(({ active }) => useDocumentScrollLock(active), {
      initialProps: { active: true },
    });
    const second = renderHook(({ active }) => useDocumentScrollLock(active), {
      initialProps: { active: true },
    });

    expect(document.documentElement).toHaveClass("modal-open");

    first.rerender({ active: false });
    expect(document.documentElement).toHaveClass("modal-open");

    second.unmount();
    expect(document.documentElement).not.toHaveClass("modal-open");
  });

  it("reconciles orphaned DOM state across route and app lifecycle changes", () => {
    document.documentElement.classList.add("modal-open");
    const lifecycle = renderHook(({ routeKey }) => useDocumentScrollLockLifecycle(routeKey), {
      initialProps: { routeKey: "/home" },
    });

    expect(document.documentElement).not.toHaveClass("modal-open");

    const owner = renderHook(() => useDocumentScrollLock(true));
    document.documentElement.classList.remove("modal-open");
    act(() => window.dispatchEvent(new Event("pageshow")));
    expect(document.documentElement).toHaveClass("modal-open");

    document.documentElement.classList.remove("modal-open");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(document.documentElement).toHaveClass("modal-open");

    owner.unmount();
    document.documentElement.classList.add("modal-open");
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(document.documentElement).not.toHaveClass("modal-open");

    lifecycle.rerender({ routeKey: "/home/garden" });
    expect(document.documentElement).not.toHaveClass("modal-open");
  });
});
