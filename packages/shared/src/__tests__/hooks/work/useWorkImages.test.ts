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
  createLogger: () => ({ debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
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

import { useWorkImages, useWorkPreviewUrls } from "../../../hooks/work/useWorkImages";
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

  it("does not read or write the retired unscoped image store", () => {
    mockIdbGet.mockResolvedValue(createMockFiles(2));
    const { result, unmount } = renderHook(() => useWorkImages());
    act(() => result.current.setImages(createMockFiles(1)));
    act(() => result.current.setImages([]));
    unmount();
    expect(mockIdbGet).not.toHaveBeenCalled();
    expect(mockIdbSet).not.toHaveBeenCalled();
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

describe("mounted preview ownership", () => {
  it("keeps text rerenders bounded and replaces revoked URLs after remount", async () => {
    const { mediaResourceManager } = await import(
      "../../../modules/job-queue/media-resource-manager"
    );
    mediaResourceManager.cleanupAll();
    let serial = 0;
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation(() => `blob:preview-${++serial}`);
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const file = new File(["proof"], "photo.jpg", { type: "image/jpeg" });
    const files = [file];
    const first = renderHook(({ files }) => useWorkPreviewUrls(files), { initialProps: { files } });
    await waitFor(() => expect(first.result.current[0]).toBeTruthy());
    const old = first.result.current[0];
    for (let n = 0; n < 20; n++) first.rerender({ files });
    expect(create).toHaveBeenCalledTimes(1);
    expect(mediaResourceManager.getStats().totalUrls).toBe(1);
    first.rerender({ files: [] });
    await waitFor(() => expect(revoke).toHaveBeenCalledWith(old));
    expect(mediaResourceManager.getStats().totalUrls).toBe(0);
    first.unmount();
    const second = renderHook(() => useWorkPreviewUrls(files));
    await waitFor(() => expect(second.result.current[0]).toBeTruthy());
    expect(second.result.current[0]).not.toBe(old);
    second.unmount();
    expect(mediaResourceManager.getStats()).toEqual({ totalUrls: 0, trackedIds: 0 });
    create.mockRestore();
    revoke.mockRestore();
  });
});
