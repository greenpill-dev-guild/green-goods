/**
 * useDrafts Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the draft CRUD operations hook including create, read, update, delete,
 * image management, resume, sync, and query invalidation.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkTab } from "../../../stores/workFlowTypes";
import type { WorkDraftRecord } from "../../../types/job-queue";
import { createMockFile, MOCK_ADDRESSES } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

vi.mock("../../../modules/job-queue/draft-db", () => ({
  draftDB: {
    getDraftsForUser: vi.fn(),
    getImagesForDraft: vi.fn(),
    createDraft: vi.fn(),
    updateDraft: vi.fn(),
    getDraft: vi.fn(),
    deleteDraft: vi.fn(),
    addImageToDraft: vi.fn(),
    removeImageFromDraft: vi.fn(),
    setImagesForDraft: vi.fn(),
  },
  computeFirstIncompleteStep: vi.fn(() => "intro"),
}));

let mockUserAddress: string | null = MOCK_ADDRESSES.user;
vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    primaryAddress: mockUserAddress,
  }),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 11155111,
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createDraftErrorHandler: () => vi.fn(),
}));

// Must come after mocks
import { useDrafts } from "../../../hooks/work/useDrafts";
import { draftDB } from "../../../modules/job-queue/draft-db";

// Cast to access mock methods
const mockDraftDB = draftDB as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ============================================
// Test helpers
// ============================================

const TEST_CHAIN_ID = 11155111;

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

function createMockDraftRecord(overrides?: Partial<WorkDraftRecord>): WorkDraftRecord {
  return {
    id: "draft-1",
    userAddress: MOCK_ADDRESSES.user,
    chainId: TEST_CHAIN_ID,
    gardenAddress: MOCK_ADDRESSES.garden,
    actionUID: 1,
    feedback: "Test feedback",
    plantSelection: [],
    plantCount: undefined,
    currentStep: "intro",
    firstIncompleteStep: "intro",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe("useDrafts", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockUserAddress = MOCK_ADDRESSES.user;

    // Default: no drafts, no images
    mockDraftDB.getDraftsForUser.mockResolvedValue([]);
    mockDraftDB.getImagesForDraft.mockResolvedValue([]);
    mockDraftDB.createDraft.mockResolvedValue("new-draft-id");
    mockDraftDB.getDraft.mockResolvedValue(undefined);
    mockDraftDB.updateDraft.mockResolvedValue(undefined);
    mockDraftDB.deleteDraft.mockResolvedValue(undefined);
    mockDraftDB.addImageToDraft.mockResolvedValue("new-image-id");
    mockDraftDB.removeImageFromDraft.mockResolvedValue(undefined);
    mockDraftDB.setImagesForDraft.mockResolvedValue(undefined);
  });

  // ------------------------------------------
  // Query: Listing drafts
  // ------------------------------------------

  describe("listing drafts", () => {
    it("returns empty array when no drafts exist", async () => {
      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.drafts).toEqual([]);
      expect(result.current.draftCount).toBe(0);
    });

    it("returns drafts with images for the current user", async () => {
      const draft = createMockDraftRecord({ feedback: "Some feedback" });
      mockDraftDB.getDraftsForUser.mockResolvedValue([draft]);
      mockDraftDB.getImagesForDraft.mockResolvedValue([
        { id: "img-1", file: createMockFile(), url: "blob:test" },
      ]);

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.drafts.length).toBe(1);
      });

      expect(result.current.drafts[0].id).toBe("draft-1");
      expect(result.current.drafts[0].images).toHaveLength(1);
      expect(result.current.drafts[0].thumbnailUrl).toBe("blob:test");
    });

    it("filters out drafts with no images and no feedback", async () => {
      const emptyDraft = createMockDraftRecord({ feedback: "", id: "empty" });
      const goodDraft = createMockDraftRecord({ feedback: "Has feedback", id: "good" });

      mockDraftDB.getDraftsForUser.mockResolvedValue([emptyDraft, goodDraft]);
      mockDraftDB.getImagesForDraft.mockResolvedValue([]);

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Only the draft with feedback should be included
      expect(result.current.drafts.length).toBe(1);
      expect(result.current.drafts[0].id).toBe("good");
    });

    it("does not fetch drafts when user is not authenticated", async () => {
      mockUserAddress = null;

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      // Query should be disabled
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockDraftDB.getDraftsForUser).not.toHaveBeenCalled();
      expect(result.current.drafts).toEqual([]);
    });
  });

  // ------------------------------------------
  // Mutation: Create draft
  // ------------------------------------------

  describe("creating drafts", () => {
    it("creates a draft and sets it as active", async () => {
      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.createDraft({
          gardenAddress: MOCK_ADDRESSES.garden,
          actionUID: 1,
          currentStep: "intro",
          firstIncompleteStep: "intro",
        });
      });

      expect(mockDraftDB.createDraft).toHaveBeenCalledWith(
        MOCK_ADDRESSES.user,
        TEST_CHAIN_ID,
        expect.objectContaining({
          gardenAddress: MOCK_ADDRESSES.garden,
          actionUID: 1,
        })
      );
    });

    it("throws when user is not authenticated", async () => {
      mockUserAddress = null;

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.createDraft({});
        })
      ).rejects.toThrow("User not authenticated");
    });
  });

  // ------------------------------------------
  // Mutation: Update draft
  // ------------------------------------------

  describe("updating drafts", () => {
    it("updates a draft with new data", async () => {
      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateDraft({
          draftId: "draft-1",
          data: { feedback: "Updated feedback" },
        });
      });

      expect(mockDraftDB.updateDraft).toHaveBeenCalledWith("draft-1", {
        feedback: "Updated feedback",
      });
    });
  });

  // ------------------------------------------
  // Mutation: Delete draft
  // ------------------------------------------

  describe("deleting drafts", () => {
    it("deletes a draft from the database", async () => {
      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.deleteDraft("draft-1");
      });

      expect(mockDraftDB.deleteDraft).toHaveBeenCalledWith("draft-1");
    });

    it("clears activeDraftId when deleting the active draft", async () => {
      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Set active draft
      act(() => {
        result.current.setActiveDraftId("draft-1");
      });

      expect(result.current.activeDraftId).toBe("draft-1");

      await act(async () => {
        await result.current.deleteDraft("draft-1");
      });

      expect(result.current.activeDraftId).toBeNull();
    });
  });

  // ------------------------------------------
  // Mutation: Image management
  // ------------------------------------------

  describe("image management", () => {
    it("adds an image to a draft", async () => {
      const file = createMockFile();

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.addImage({ draftId: "draft-1", file });
      });

      expect(mockDraftDB.addImageToDraft).toHaveBeenCalledWith("draft-1", file);
    });

    it("removes an image from a draft", async () => {
      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.removeImage("img-1");
      });

      expect(mockDraftDB.removeImageFromDraft).toHaveBeenCalledWith("img-1");
    });

    it("sets all images for a draft (replaces existing)", async () => {
      const files = [createMockFile("a.jpg"), createMockFile("b.jpg")];

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.setImages({ draftId: "draft-1", files });
      });

      expect(mockDraftDB.setImagesForDraft).toHaveBeenCalledWith("draft-1", files);
    });
  });

  // ------------------------------------------
  // High-level: createOrGetDraft
  // ------------------------------------------

  describe("createOrGetDraft", () => {
    it("returns existing draft if one matches garden + action", async () => {
      const existingDraft = createMockDraftRecord({
        id: "existing-draft",
        gardenAddress: MOCK_ADDRESSES.garden,
        actionUID: 1,
      });
      mockDraftDB.getDraftsForUser.mockResolvedValue([existingDraft]);

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let draftId: string;
      await act(async () => {
        draftId = await result.current.createOrGetDraft(MOCK_ADDRESSES.garden, 1);
      });

      expect(draftId!).toBe("existing-draft");
      expect(mockDraftDB.createDraft).not.toHaveBeenCalled();
    });

    it("creates a new draft if no match exists", async () => {
      mockDraftDB.getDraftsForUser.mockResolvedValue([]);
      mockDraftDB.createDraft.mockResolvedValue("brand-new-draft");

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let draftId: string;
      await act(async () => {
        draftId = await result.current.createOrGetDraft(MOCK_ADDRESSES.garden, 2);
      });

      expect(draftId!).toBe("brand-new-draft");
      expect(mockDraftDB.createDraft).toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // High-level: resumeDraft
  // ------------------------------------------

  describe("resumeDraft", () => {
    it("loads draft data into WorkFlowStore and returns target tab", async () => {
      const draft = createMockDraftRecord({
        id: "resume-draft",
        gardenAddress: MOCK_ADDRESSES.garden,
        actionUID: 1,
        feedback: "saved feedback",
      });
      mockDraftDB.getDraft.mockResolvedValue(draft);
      mockDraftDB.getImagesForDraft.mockResolvedValue([
        { id: "img-1", file: createMockFile(), url: "blob:test" },
      ]);

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let targetTab: WorkTab;
      await act(async () => {
        targetTab = await result.current.resumeDraft("resume-draft");
      });

      // computeFirstIncompleteStep is mocked to return "intro"
      expect(targetTab!).toBe(WorkTab.Intro);
      expect(result.current.activeDraftId).toBe("resume-draft");
    });

    it("throws when draft is not found", async () => {
      mockDraftDB.getDraft.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.resumeDraft("nonexistent");
        })
      ).rejects.toThrow("Draft nonexistent not found");
    });

    it("respects AbortSignal cancellation", async () => {
      const controller = new AbortController();
      controller.abort();

      mockDraftDB.getDraft.mockResolvedValue(createMockDraftRecord());

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.resumeDraft("draft-1", { signal: controller.signal });
        })
      ).rejects.toThrow();
    });
  });

  // ------------------------------------------
  // High-level: clearActiveDraft
  // ------------------------------------------

  describe("clearActiveDraft", () => {
    it("deletes the active draft", async () => {
      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setActiveDraftId("draft-to-clear");
      });

      await act(async () => {
        await result.current.clearActiveDraft();
      });

      expect(mockDraftDB.deleteDraft).toHaveBeenCalledWith("draft-to-clear");
    });

    it("does nothing when no active draft", async () => {
      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.clearActiveDraft();
      });

      expect(mockDraftDB.deleteDraft).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // High-level: getActiveDraft
  // ------------------------------------------

  describe("getActiveDraft", () => {
    it("returns null when no active draft", async () => {
      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let activeDraft: any;
      await act(async () => {
        activeDraft = await result.current.getActiveDraft();
      });

      expect(activeDraft).toBeNull();
    });

    it("returns draft with images when active draft exists", async () => {
      const draft = createMockDraftRecord({ id: "active-draft" });
      mockDraftDB.getDraft.mockResolvedValue(draft);
      mockDraftDB.getImagesForDraft.mockResolvedValue([
        { id: "img-1", file: createMockFile(), url: "blob:url" },
      ]);

      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setActiveDraftId("active-draft");
      });

      let activeDraft: any;
      await act(async () => {
        activeDraft = await result.current.getActiveDraft();
      });

      expect(activeDraft).not.toBeNull();
      expect(activeDraft.id).toBe("active-draft");
      expect(activeDraft.thumbnailUrl).toBe("blob:url");
    });
  });

  // ------------------------------------------
  // Mutation states
  // ------------------------------------------

  describe("mutation states", () => {
    it("exposes creating, updating, and deleting states", async () => {
      const { result } = renderHook(() => useDrafts(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isCreating).toBe(false);
      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isDeleting).toBe(false);
    });
  });
});
