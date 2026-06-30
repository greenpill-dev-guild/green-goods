import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import toast, { Toaster } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { walletProgressToasts } from "../../../components/Toast/presets/wallet";
import { toastService } from "../../../components/Toast/toast.service";

/**
 * These tests lock in the fix for the "toasts never auto-dismiss, must be
 * tapped" bug. Root cause: react-hot-toast drives auto-dismiss from a single
 * global `pausedAt` flag (set on hover) that latches on touch and freezes
 * dismissal for every toast. The service now owns dismissal via its own timers
 * (the library gets `duration: Infinity`), so these assert OUR timer behavior.
 */
describe("toastService auto-dismiss (service-owned timers)", () => {
  let dismissSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // react-hot-toast has a module-level store; purge leftovers from prior tests
    // (done before spying so this uses the real remove).
    toast.remove();
    // Mock so a fired timer is observable without touching the real store.
    dismissSpy = vi.spyOn(toast, "dismiss").mockImplementation((() => {}) as typeof toast.dismiss);
  });

  afterEach(() => {
    toastService.dismissAll(); // clears our timers
    cleanup(); // unmount any rendered <Toaster>
    dismissSpy.mockRestore();
    toast.remove(); // purge the library store with the real remove
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("auto-dismisses a success toast after its default 3000ms duration", () => {
    toastService.success({ id: "s1", message: "ok" });
    vi.advanceTimersByTime(2999);
    expect(dismissSpy).not.toHaveBeenCalledWith("s1");
    vi.advanceTimersByTime(2);
    expect(dismissSpy).toHaveBeenCalledWith("s1");
  });

  it("auto-dismisses an error toast after 4500ms", () => {
    toastService.error({ id: "e1", message: "bad" });
    vi.advanceTimersByTime(4499);
    expect(dismissSpy).not.toHaveBeenCalledWith("e1");
    vi.advanceTimersByTime(2);
    expect(dismissSpy).toHaveBeenCalledWith("e1");
  });

  it("respects a custom finite duration", () => {
    toastService.success({ id: "c1", message: "ok", duration: 1000 });
    vi.advanceTimersByTime(1001);
    expect(dismissSpy).toHaveBeenCalledWith("c1");
  });

  it("does NOT auto-dismiss a persistent toast", () => {
    toastService.info({ id: "p1", message: "stay", persistent: true });
    vi.advanceTimersByTime(120_000);
    expect(dismissSpy).not.toHaveBeenCalledWith("p1");
  });

  it("treats an explicit duration: Infinity as persistent (no auto-dismiss)", () => {
    toastService.info({ id: "p2", message: "stay", duration: Number.POSITIVE_INFINITY });
    vi.advanceTimersByTime(120_000);
    expect(dismissSpy).not.toHaveBeenCalledWith("p2");
  });

  it("reschedules to the short duration when a loading toast is replaced by success on the same id", () => {
    toastService.loading({ id: "work-upload", message: "uploading" });
    vi.advanceTimersByTime(5000); // would not have fired at loading's 20s
    expect(dismissSpy).not.toHaveBeenCalledWith("work-upload");

    toastService.success({ id: "work-upload", message: "done" });
    vi.advanceTimersByTime(3001); // success default
    expect(dismissSpy).toHaveBeenCalledWith("work-upload");
  });

  it("cancels the pending auto-dismiss when dismissed manually (no late double-dismiss)", () => {
    toastService.success({ id: "m1", message: "ok" });
    toastService.dismiss("m1");
    expect(dismissSpy).toHaveBeenCalledWith("m1");

    dismissSpy.mockClear();
    vi.advanceTimersByTime(10_000);
    expect(dismissSpy).not.toHaveBeenCalledWith("m1");
  });

  it("keeps the wallet 'confirm in wallet' (human-wait) stage persistent — no auto-dismiss mid-signature", () => {
    walletProgressToasts.confirming();
    vi.advanceTimersByTime(120_000); // far longer than the old 20s loading window
    expect(dismissSpy).not.toHaveBeenCalledWith("wallet-submission");
  });

  it("still auto-dismisses a fast app-driven loading stage after its 20s safety window", () => {
    walletProgressToasts.uploading();
    vi.advanceTimersByTime(20_001);
    expect(dismissSpy).toHaveBeenCalledWith("wallet-submission");
  });

  describe("hover/focus pause (rendered)", () => {
    it("pauses the countdown while hovered and resumes on leave", () => {
      render(<Toaster />);
      act(() => {
        toastService.success({ id: "h1", message: "hover me" });
      });
      const content = screen.getByTestId("toast-content");

      fireEvent.pointerEnter(content);
      vi.advanceTimersByTime(5000); // well past 3000ms, but paused
      expect(dismissSpy).not.toHaveBeenCalledWith("h1");

      fireEvent.pointerLeave(content);
      vi.advanceTimersByTime(3001); // remaining time resumes
      expect(dismissSpy).toHaveBeenCalledWith("h1");
    });

    it("force-resumes via the safety cap if the leave never arrives (can't get stuck)", () => {
      render(<Toaster />);
      act(() => {
        toastService.success({ id: "h2", message: "stuck?", duration: 3000 });
      });
      const content = screen.getByTestId("toast-content");

      fireEvent.pointerEnter(content); // paused, and NO matching leave
      // Cap (8000ms) force-resumes, then the ~3000ms remainder elapses.
      vi.advanceTimersByTime(8000 + 3001);
      expect(dismissSpy).toHaveBeenCalledWith("h2");
    });

    it("does not pause a persistent toast (nothing to pause, stays put)", () => {
      render(<Toaster />);
      act(() => {
        toastService.info({ id: "h3", message: "persist", persistent: true });
      });
      const content = screen.getByTestId("toast-content");

      fireEvent.pointerEnter(content);
      fireEvent.pointerLeave(content);
      vi.advanceTimersByTime(120_000);
      expect(dismissSpy).not.toHaveBeenCalledWith("h3");
    });
  });
});
