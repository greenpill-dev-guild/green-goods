/**
 * useCopyToClipboard Hook Tests
 * @vitest-environment jsdom
 *
 * Tests clipboard copy functionality, auto-reset timer,
 * success/failure callbacks, and cleanup.
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the clipboard utility
const mockCopyToClipboard = vi.fn();
vi.mock("../../../utils/app/clipboard", () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}));

import { useCopyToClipboard } from "../../../hooks/utils/useCopyToClipboard";

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockCopyToClipboard.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ------------------------------------------
  // Initial state
  // ------------------------------------------

  describe("initial state", () => {
    it("starts with copied=false", () => {
      const { result } = renderHook(() => useCopyToClipboard());
      expect(result.current.copied).toBe(false);
    });
  });

  // ------------------------------------------
  // Successful copy
  // ------------------------------------------

  describe("successful copy", () => {
    it("sets copied=true and returns true", async () => {
      const { result } = renderHook(() => useCopyToClipboard());

      let success: boolean;
      await act(async () => {
        success = await result.current.copy("Hello");
      });

      expect(success!).toBe(true);
      expect(result.current.copied).toBe(true);
      expect(mockCopyToClipboard).toHaveBeenCalledWith("Hello");
    });

    it("auto-resets after default delay (2000ms)", async () => {
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy("test");
      });

      expect(result.current.copied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.copied).toBe(false);
    });

    it("auto-resets after custom delay", async () => {
      const { result } = renderHook(() => useCopyToClipboard({ resetDelay: 500 }));

      await act(async () => {
        await result.current.copy("test");
      });

      expect(result.current.copied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.copied).toBe(false);
    });

    it("calls onSuccess callback", async () => {
      const onSuccess = vi.fn();
      const { result } = renderHook(() => useCopyToClipboard({ onSuccess }));

      await act(async () => {
        await result.current.copy("test");
      });

      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  // ------------------------------------------
  // Failed copy
  // ------------------------------------------

  describe("failed copy", () => {
    it("returns false when copyToClipboard returns false", async () => {
      mockCopyToClipboard.mockResolvedValue(false);

      const { result } = renderHook(() => useCopyToClipboard());

      let success: boolean;
      await act(async () => {
        success = await result.current.copy("test");
      });

      expect(success!).toBe(false);
      expect(result.current.copied).toBe(false);
    });

    it("calls onError when copyToClipboard returns false", async () => {
      mockCopyToClipboard.mockResolvedValue(false);
      const onError = vi.fn();

      const { result } = renderHook(() => useCopyToClipboard({ onError }));

      await act(async () => {
        await result.current.copy("test");
      });

      expect(onError).toHaveBeenCalledOnce();
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it("returns false and calls onError when copyToClipboard throws", async () => {
      const error = new Error("Clipboard API unavailable");
      mockCopyToClipboard.mockRejectedValue(error);
      const onError = vi.fn();

      const { result } = renderHook(() => useCopyToClipboard({ onError }));

      let success: boolean;
      await act(async () => {
        success = await result.current.copy("test");
      });

      expect(success!).toBe(false);
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  // ------------------------------------------
  // Manual reset
  // ------------------------------------------

  describe("reset", () => {
    it("manually resets copied state", async () => {
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy("test");
      });

      expect(result.current.copied).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.copied).toBe(false);
    });

    it("cancels pending auto-reset timer", async () => {
      const { result } = renderHook(() => useCopyToClipboard({ resetDelay: 5000 }));

      await act(async () => {
        await result.current.copy("test");
      });

      // Manually reset immediately
      act(() => {
        result.current.reset();
      });

      expect(result.current.copied).toBe(false);

      // Advance past the original delay — should stay false (timer was cleared)
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.copied).toBe(false);
    });
  });

  // ------------------------------------------
  // Unmount cleanup
  // ------------------------------------------

  describe("unmount cleanup", () => {
    it("cleans up reset timer on unmount", async () => {
      const { result, unmount } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy("test");
      });

      // Unmount before auto-reset timer fires
      unmount();

      // Should not throw or cause issues
      vi.advanceTimersByTime(5000);
    });
  });

  // ------------------------------------------
  // Rapid copies
  // ------------------------------------------

  describe("rapid copies", () => {
    it("resets timer on each new copy", async () => {
      const { result } = renderHook(() => useCopyToClipboard({ resetDelay: 2000 }));

      await act(async () => {
        await result.current.copy("first");
      });

      // Advance 1500ms (not enough to reset)
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(result.current.copied).toBe(true);

      // Copy again — should reset the timer
      await act(async () => {
        await result.current.copy("second");
      });

      // Advance another 1500ms (3000ms total from first copy, but only 1500ms from second)
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(result.current.copied).toBe(true);

      // Advance another 500ms (2000ms from second copy)
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.copied).toBe(false);
    });
  });
});
