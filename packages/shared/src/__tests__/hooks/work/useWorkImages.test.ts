/**
 * useWorkImages Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the work images hook including IndexedDB persistence (load/save),
 * isMounted guard for async cleanup (Rule 3), Zustand store integration,
 * and dispatch adapter for React.SetStateAction API.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockFile, createMockFiles } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

const mockIdbGet = vi.fn();
const mockIdbSet = vi.fn();

vi.mock("idb-keyval", () => ({
  get: (...args: unknown[]) => mockIdbGet(...args),
  set: (...args: unknown[]) => mockIdbSet(...args),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackStorageError: vi.fn(),
}));

vi.mock("../../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
}));

import { useWorkImages } from "../../../hooks/work/useWorkImages";
// We need to let Zustand work normally for this hook since it directly reads/writes the store
// But we need to reset the store between tests
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";

// ============================================
// Tests
// ============================================

describe("useWorkImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the Zustand store between tests
    useWorkFlowStore.getState().reset();

    // Default: no stored images
    mockIdbGet.mockResolvedValue(undefined);
    mockIdbSet.mockResolvedValue(undefined);
  });

  // ------------------------------------------
  // Initial state
  // ------------------------------------------

  describe("initial state", () => {
    it("returns empty images array initially", () => {
      const { result } = renderHook(() => useWorkImages());

      expect(result.current.images).toEqual([]);
    });

    it("provides a setImages function", () => {
      const { result } = renderHook(() => useWorkImages());

      expect(typeof result.current.setImages).toBe("function");
    });
  });

  // ------------------------------------------
  // Loading from IndexedDB on mount
  // ------------------------------------------

  describe("loading from IndexedDB", () => {
    it("loads stored images from IDB on mount", async () => {
      const storedFiles = createMockFiles(2);
      mockIdbGet.mockResolvedValue(storedFiles);

      const { result } = renderHook(() => useWorkImages());

      await waitFor(() => {
        expect(result.current.images).toHaveLength(2);
      });

      expect(mockIdbGet).toHaveBeenCalledWith("work_images_draft");
    });

    it("does not load when IDB returns undefined", async () => {
      mockIdbGet.mockResolvedValue(undefined);

      const { result } = renderHook(() => useWorkImages());

      // Give it time to potentially load
      await new Promise((r) => setTimeout(r, 50));

      expect(result.current.images).toEqual([]);
    });

    it("does not load when IDB returns empty array", async () => {
      mockIdbGet.mockResolvedValue([]);

      const { result } = renderHook(() => useWorkImages());

      await new Promise((r) => setTimeout(r, 50));

      expect(result.current.images).toEqual([]);
    });

    it("handles IDB load errors gracefully", async () => {
      mockIdbGet.mockRejectedValue(new Error("IndexedDB not available"));

      const { result } = renderHook(() => useWorkImages());

      // Should not throw, images should remain empty
      await new Promise((r) => setTimeout(r, 50));

      expect(result.current.images).toEqual([]);
    });

    it("respects isMounted guard (Rule 3) - does not update after unmount", async () => {
      // Simulate slow IDB read
      let resolveIdb!: (value: File[]) => void;
      mockIdbGet.mockReturnValue(
        new Promise((resolve) => {
          resolveIdb = resolve;
        })
      );

      const { result, unmount } = renderHook(() => useWorkImages());

      // Unmount before IDB resolves
      unmount();

      // Now resolve - should not update state
      resolveIdb(createMockFiles(3));

      // Store should not have been updated
      expect(useWorkFlowStore.getState().images).toEqual([]);
    });
  });

  // ------------------------------------------
  // Saving to IndexedDB on change
  // ------------------------------------------

  describe("saving to IndexedDB", () => {
    it("saves images to IDB when they change", async () => {
      const { result } = renderHook(() => useWorkImages());

      const newFiles = createMockFiles(2);

      act(() => {
        result.current.setImages(newFiles);
      });

      await waitFor(() => {
        expect(mockIdbSet).toHaveBeenCalledWith("work_images_draft", newFiles);
      });
    });

    it("saves empty array to IDB on reset (clears stored data)", async () => {
      // Start with images
      const files = createMockFiles(2);
      useWorkFlowStore.getState().setImages(files);

      const { result } = renderHook(() => useWorkImages());

      // Clear images
      act(() => {
        result.current.setImages([]);
      });

      await waitFor(() => {
        expect(mockIdbSet).toHaveBeenCalledWith("work_images_draft", []);
      });
    });

    it("handles IDB save errors gracefully", async () => {
      mockIdbSet.mockRejectedValue(new Error("Quota exceeded"));

      const { result } = renderHook(() => useWorkImages());

      // Should not throw
      act(() => {
        result.current.setImages(createMockFiles(1));
      });

      // Wait for async save to complete (or fail)
      await new Promise((r) => setTimeout(r, 50));

      // Images should still be in state even if IDB save failed
      expect(result.current.images).toHaveLength(1);
    });
  });

  // ------------------------------------------
  // Dispatch adapter (SetStateAction API)
  // ------------------------------------------

  describe("dispatch adapter", () => {
    it("supports direct value setting", () => {
      const { result } = renderHook(() => useWorkImages());

      const files = createMockFiles(3);

      act(() => {
        result.current.setImages(files);
      });

      expect(result.current.images).toHaveLength(3);
    });

    it("supports functional updates", () => {
      const { result } = renderHook(() => useWorkImages());

      // Set initial images
      const initialFiles = createMockFiles(2);
      act(() => {
        result.current.setImages(initialFiles);
      });

      expect(result.current.images).toHaveLength(2);

      // Use functional update to add an image
      const newFile = createMockFile("new-image.jpg");
      act(() => {
        result.current.setImages((prev: File[]) => [...prev, newFile]);
      });

      expect(result.current.images).toHaveLength(3);
    });

    it("reads fresh state for functional updates (avoids stale closure)", () => {
      const { result } = renderHook(() => useWorkImages());

      // Set images directly in the store
      const files = createMockFiles(2);
      act(() => {
        useWorkFlowStore.getState().setImages(files);
      });

      // Functional update should see the latest store state
      const newFile = createMockFile("extra.jpg");
      act(() => {
        result.current.setImages((prev: File[]) => [...prev, newFile]);
      });

      expect(result.current.images).toHaveLength(3);
    });
  });

  // ------------------------------------------
  // Store integration
  // ------------------------------------------

  describe("Zustand store integration", () => {
    it("reads images from WorkFlowStore", () => {
      const files = createMockFiles(2);
      useWorkFlowStore.getState().setImages(files);

      const { result } = renderHook(() => useWorkImages());

      expect(result.current.images).toBe(files);
    });

    it("writes images to WorkFlowStore", () => {
      const { result } = renderHook(() => useWorkImages());

      const files = createMockFiles(3);
      act(() => {
        result.current.setImages(files);
      });

      expect(useWorkFlowStore.getState().images).toBe(files);
    });
  });
});
