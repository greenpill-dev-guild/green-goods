/**
 * useDraftAutoSave Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the draft save-on-exit hook including meaningful progress detection,
 * save/create logic, error handling, and concurrent save prevention.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockFile, MOCK_ADDRESSES } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

// Mock useDrafts return value
const mockCreateDraft = vi.fn();
const mockUpdateDraft = vi.fn();
const mockSetImages = vi.fn();
let mockActiveDraftId: string | null = null;

vi.mock("../../../hooks/work/useDrafts", () => ({
  useDrafts: () => ({
    activeDraftId: mockActiveDraftId,
    createDraft: mockCreateDraft,
    updateDraft: mockUpdateDraft,
    setImages: mockSetImages,
  }),
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

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: MOCK_ADDRESSES.user }),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 11155111,
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createDraftErrorHandler: () => vi.fn(),
}));

vi.mock("../../../modules/job-queue/draft-db", () => ({
  draftDB: {
    getDraftsForUser: vi.fn().mockResolvedValue([]),
    getImagesForDraft: vi.fn().mockResolvedValue([]),
    createDraft: vi.fn().mockResolvedValue("mock-draft-id"),
    updateDraft: vi.fn(),
    getDraft: vi.fn(),
    deleteDraft: vi.fn(),
    addImageToDraft: vi.fn(),
    removeImageFromDraft: vi.fn(),
    setImagesForDraft: vi.fn(),
  },
  computeFirstIncompleteStep: vi.fn(() => "intro"),
}));

import { useDraftAutoSave } from "../../../hooks/work/useDraftAutoSave";

// ============================================
// Test helpers
// ============================================

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createFormData(overrides = {}) {
  return {
    gardenAddress: MOCK_ADDRESSES.garden,
    actionUID: 1,
    feedback: "",
    plantSelection: [] as string[],
    plantCount: null as number | null,
    timeSpentMinutes: 0,
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe("useDraftAutoSave", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockActiveDraftId = null;
    mockCreateDraft.mockResolvedValue("new-draft-id");
    mockUpdateDraft.mockResolvedValue(undefined);
    mockSetImages.mockResolvedValue(undefined);
  });

  // ------------------------------------------
  // hasMeaningfulProgress detection
  // ------------------------------------------

  describe("hasMeaningfulProgress", () => {
    it("returns false when no images and no form data", () => {
      const { result } = renderHook(() => useDraftAutoSave(createFormData(), undefined), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hasMeaningfulProgress).toBe(false);
    });

    it("returns true when images are present", () => {
      const images = [createMockFile()];
      const { result } = renderHook(() => useDraftAutoSave(createFormData(), images), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hasMeaningfulProgress).toBe(true);
    });

    it("returns true when feedback is provided", () => {
      const { result } = renderHook(
        () => useDraftAutoSave(createFormData({ feedback: "Some work notes" }), undefined),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.hasMeaningfulProgress).toBe(true);
    });

    it("returns true when time spent is non-zero", () => {
      const { result } = renderHook(
        () => useDraftAutoSave(createFormData({ timeSpentMinutes: 30 }), undefined),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.hasMeaningfulProgress).toBe(true);
    });
  });

  // ------------------------------------------
  // saveOnExit
  // ------------------------------------------

  describe("saveOnExit", () => {
    it("does not save when there is no meaningful progress", async () => {
      const { result } = renderHook(() => useDraftAutoSave(createFormData(), undefined), {
        wrapper: createWrapper(queryClient),
      });

      let savedId: string | null;
      await act(async () => {
        savedId = await result.current.saveOnExit();
      });

      expect(savedId!).toBeNull();
      expect(mockCreateDraft).not.toHaveBeenCalled();
      expect(mockUpdateDraft).not.toHaveBeenCalled();
    });

    it("creates a new draft when no active draft and there is progress", async () => {
      const images = [createMockFile()];

      const { result } = renderHook(
        () => useDraftAutoSave(createFormData({ feedback: "My work notes" }), images),
        { wrapper: createWrapper(queryClient) }
      );

      let savedId: string | null;
      await act(async () => {
        savedId = await result.current.saveOnExit();
      });

      expect(savedId!).toBe("new-draft-id");
      expect(mockCreateDraft).toHaveBeenCalledOnce();
      expect(mockSetImages).toHaveBeenCalledWith({
        draftId: "new-draft-id",
        files: images,
      });
    });

    it("updates existing draft when active draft exists", async () => {
      mockActiveDraftId = "existing-draft";

      const { result } = renderHook(
        () => useDraftAutoSave(createFormData({ feedback: "Updated notes" }), [createMockFile()]),
        { wrapper: createWrapper(queryClient) }
      );

      let savedId: string | null;
      await act(async () => {
        savedId = await result.current.saveOnExit();
      });

      expect(savedId!).toBe("existing-draft");
      expect(mockUpdateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          draftId: "existing-draft",
          data: expect.objectContaining({
            feedback: "Updated notes",
          }),
        })
      );
    });

    it("does not sync images when there are none", async () => {
      const { result } = renderHook(
        () => useDraftAutoSave(createFormData({ feedback: "Just feedback, no images" }), []),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.saveOnExit();
      });

      expect(mockSetImages).not.toHaveBeenCalled();
    });

    it("does not save when disabled", async () => {
      const { result } = renderHook(
        () =>
          useDraftAutoSave(createFormData({ feedback: "Has progress" }), [createMockFile()], {
            enabled: false,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      let savedId: string | null;
      await act(async () => {
        savedId = await result.current.saveOnExit();
      });

      expect(savedId!).toBeNull();
      expect(mockCreateDraft).not.toHaveBeenCalled();
    });

    it("returns null and does not throw on save error", async () => {
      mockCreateDraft.mockRejectedValue(new Error("IndexedDB full"));

      const { result } = renderHook(
        () => useDraftAutoSave(createFormData({ feedback: "Will fail" }), [createMockFile()]),
        { wrapper: createWrapper(queryClient) }
      );

      let savedId: string | null;
      await act(async () => {
        savedId = await result.current.saveOnExit();
      });

      // Should gracefully handle the error
      expect(savedId!).toBeNull();
    });

    it("prevents concurrent saves via isSavingRef", async () => {
      // Make createDraft take a while
      let resolveCreate!: (value: string) => void;
      mockCreateDraft.mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );

      const { result } = renderHook(
        () => useDraftAutoSave(createFormData({ feedback: "Saving" }), [createMockFile()]),
        { wrapper: createWrapper(queryClient) }
      );

      // Start first save
      const firstSave = act(async () => {
        return result.current.saveOnExit();
      });

      // Try second save while first is in progress
      let secondResult: string | null;
      await act(async () => {
        secondResult = await result.current.saveOnExit();
      });

      // Second save should be rejected (returns null)
      expect(secondResult!).toBeNull();

      // Resolve first save
      resolveCreate("first-draft");
      await firstSave;

      // Only one create call
      expect(mockCreateDraft).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------
  // hasDraft and draftId
  // ------------------------------------------

  describe("state exposure", () => {
    it("exposes hasDraft as false when no active draft", () => {
      mockActiveDraftId = null;

      const { result } = renderHook(() => useDraftAutoSave(createFormData(), undefined), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hasDraft).toBe(false);
      expect(result.current.draftId).toBeNull();
    });

    it("exposes hasDraft as true when active draft exists", () => {
      mockActiveDraftId = "active-123";

      const { result } = renderHook(() => useDraftAutoSave(createFormData(), undefined), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hasDraft).toBe(true);
      expect(result.current.draftId).toBe("active-123");
    });
  });

  // ------------------------------------------
  // Ref tracking (stale closure prevention)
  // ------------------------------------------

  describe("ref tracking", () => {
    it("uses latest form data on save via ref", async () => {
      const initialData = createFormData({ feedback: "initial" });
      const images = [createMockFile()];

      const { result, rerender } = renderHook(
        ({ formData, imgs }) => useDraftAutoSave(formData, imgs),
        {
          wrapper: createWrapper(queryClient),
          initialProps: { formData: initialData, imgs: images },
        }
      );

      // Update form data (simulating user typing)
      const updatedData = createFormData({ feedback: "updated text" });
      rerender({ formData: updatedData, imgs: images });

      await act(async () => {
        await result.current.saveOnExit();
      });

      // Should use the latest "updated text", not "initial"
      expect(mockCreateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          feedback: "updated text",
        })
      );
    });
  });
});
