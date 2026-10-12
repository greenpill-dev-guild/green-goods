/** @vitest-environment happy-dom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDocumentScrollPosition,
  useDocumentScrollLock,
  useDocumentScrollLockLifecycle,
} from "../../../hooks/ui/useDocumentScrollLock";

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove("modal-open");
  document.body.removeAttribute("data-scroll-locked");
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

  it("preserves document position and existing inline styles until the last overlay closes", () => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(720);
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    document.body.style.setProperty("width", "95%", "important");
    const first = renderHook(() => useDocumentScrollLock(true));
    const second = renderHook(() => useDocumentScrollLock(true));
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-720px");
    vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
    expect(getDocumentScrollPosition()).toEqual({ left: 0, top: 720 });
    first.unmount();
    expect(scroll).not.toHaveBeenCalled();
    second.unmount();
    expect(document.body.style.position).toBe("");
    expect(document.body.style.width).toBe("95%");
    expect(document.body.style.getPropertyPriority("width")).toBe("important");
    expect(scroll).toHaveBeenCalledWith({ left: 0, top: 720, behavior: "instant" });
    document.body.style.removeProperty("width");
  });

  it("waits for a Radix dialog's own lock before it restores the position", async () => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(720);
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const owner = renderHook(() => useDocumentScrollLock(true));
    // react-remove-scroll marks the body while the dialog is open and clears the mark one
    // effect phase after the dialog's content, where this owner lives, has unmounted.
    document.body.setAttribute("data-scroll-locked", "1");

    owner.unmount();

    // Restoring now would be lost: that lock still clips the body to the viewport height.
    expect(scroll).not.toHaveBeenCalled();
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-720px");
    expect(document.documentElement).toHaveClass("modal-open");

    document.body.removeAttribute("data-scroll-locked");

    await waitFor(() =>
      expect(scroll).toHaveBeenCalledWith({ left: 0, top: 720, behavior: "instant" })
    );
    expect(document.body.style.position).toBe("");
    expect(document.documentElement).not.toHaveClass("modal-open");
  });

  it("keeps the first position when another overlay takes the lock during that wait", async () => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(720);
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const drawer = renderHook(() => useDocumentScrollLock(true));
    document.body.setAttribute("data-scroll-locked", "1");
    drawer.unmount();
    // The page reads as unscrolled while its body is fixed; a fresh save here would lose 720.
    vi.spyOn(window, "scrollY", "get").mockReturnValue(0);

    const sheet = renderHook(() => useDocumentScrollLock(true));
    document.body.removeAttribute("data-scroll-locked");
    await act(async () => {});

    expect(scroll).not.toHaveBeenCalled();
    expect(document.body.style.top).toBe("-720px");
    expect(getDocumentScrollPosition()).toEqual({ left: 0, top: 720 });

    sheet.unmount();
    expect(scroll).toHaveBeenCalledWith({ left: 0, top: 720, behavior: "instant" });
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
