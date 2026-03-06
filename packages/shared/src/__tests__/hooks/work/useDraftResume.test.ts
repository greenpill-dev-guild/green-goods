/**
 * useDraftResume Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the draft resume hook including URL-based resumption with AbortController,
 * meaningful draft detection for dialog display, continue/start-fresh handlers,
 * and error handling.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockFile, MOCK_ADDRESSES } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

const mockResumeDraft = vi.fn();
const mockClearActiveDraft = vi.fn();
let mockActiveDraftId: string | null = null;

vi.mock("../../../hooks/work/useDrafts", () => ({
  useDrafts: () => ({
    activeDraftId: mockActiveDraftId,
    resumeDraft: mockResumeDraft,
    clearActiveDraft: mockClearActiveDraft,
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

import { useDraftResume } from "../../../hooks/work/useDraftResume";

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

function createDefaultFormState() {
  return {
    images: [] as File[],
    gardenAddress: null as string | null,
    actionUID: null as number | null,
    feedback: "",
    plantSelection: [] as string[],
    plantCount: null as number | null,
  };
}

// ============================================
// Tests
// ============================================

describe("useDraftResume", () => {
  let queryClient: QueryClient;
  let mockSetSearchParams: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockActiveDraftId = null;
    mockResumeDraft.mockResolvedValue("Intro");
    mockClearActiveDraft.mockResolvedValue(undefined);
    mockSetSearchParams = vi.fn();
  });

  // ------------------------------------------
  // Initial state
  // ------------------------------------------

  describe("initial state", () => {
    it("starts with dialog hidden", () => {
      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: createDefaultFormState(),
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.showDraftDialog).toBe(false);
    });

    it("exposes clearActiveDraft", () => {
      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: createDefaultFormState(),
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.clearActiveDraft).toBeDefined();
    });
  });

  // ------------------------------------------
  // URL-based draft resumption
  // ------------------------------------------

  describe("URL-based draft resumption", () => {
    it("resumes draft from draftId URL parameter", async () => {
      const searchParams = new URLSearchParams("draftId=url-draft-123");

      renderHook(
        () =>
          useDraftResume({
            formState: createDefaultFormState(),
            isOnIntroTab: true,
            searchParams,
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(mockResumeDraft).toHaveBeenCalledWith(
          "url-draft-123",
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
      });
    });

    it("clears draftId from URL after successful resume", async () => {
      const searchParams = new URLSearchParams("draftId=url-draft-123");

      renderHook(
        () =>
          useDraftResume({
            formState: createDefaultFormState(),
            isOnIntroTab: true,
            searchParams,
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(mockSetSearchParams).toHaveBeenCalledWith(expect.any(URLSearchParams), {
          replace: true,
        });
      });

      // Verify the draftId was removed from the params
      const calledParams = mockSetSearchParams.mock.calls[0][0];
      expect(calledParams.has("draftId")).toBe(false);
    });

    it("clears draftId from URL on resume error", async () => {
      mockResumeDraft.mockRejectedValue(new Error("Draft corrupted"));

      const searchParams = new URLSearchParams("draftId=bad-draft");

      renderHook(
        () =>
          useDraftResume({
            formState: createDefaultFormState(),
            isOnIntroTab: true,
            searchParams,
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(mockSetSearchParams).toHaveBeenCalled();
      });
    });

    it("does not resume when no draftId in URL", async () => {
      const searchParams = new URLSearchParams();

      renderHook(
        () =>
          useDraftResume({
            formState: createDefaultFormState(),
            isOnIntroTab: true,
            searchParams,
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      // Give it time to potentially fire
      await new Promise((r) => setTimeout(r, 50));

      expect(mockResumeDraft).not.toHaveBeenCalled();
    });

    it("only resumes once (idempotent)", async () => {
      const searchParams = new URLSearchParams("draftId=url-draft-123");

      const { rerender } = renderHook(
        () =>
          useDraftResume({
            formState: createDefaultFormState(),
            isOnIntroTab: true,
            searchParams,
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(mockResumeDraft).toHaveBeenCalledTimes(1);
      });

      // Re-render should not trigger another resume
      rerender();

      expect(mockResumeDraft).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------
  // Meaningful draft dialog detection
  // ------------------------------------------

  describe("meaningful draft dialog", () => {
    it("shows dialog when form has images and user is on intro tab", () => {
      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: {
              ...createDefaultFormState(),
              images: [createMockFile()],
            },
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.showDraftDialog).toBe(true);
    });

    it("shows dialog when form has selections + form input", () => {
      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: {
              ...createDefaultFormState(),
              gardenAddress: MOCK_ADDRESSES.garden,
              actionUID: 1,
              feedback: "Some feedback",
            },
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.showDraftDialog).toBe(true);
    });

    it("does not show dialog when only selections exist (no form input)", () => {
      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: {
              ...createDefaultFormState(),
              gardenAddress: MOCK_ADDRESSES.garden,
              actionUID: 1,
            },
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.showDraftDialog).toBe(false);
    });

    it("does not show dialog when not on intro tab", () => {
      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: {
              ...createDefaultFormState(),
              images: [createMockFile()],
            },
            isOnIntroTab: false,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.showDraftDialog).toBe(false);
    });

    it("does not show dialog when resuming from URL", () => {
      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: {
              ...createDefaultFormState(),
              images: [createMockFile()],
            },
            isOnIntroTab: true,
            searchParams: new URLSearchParams("draftId=resume-draft"),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.showDraftDialog).toBe(false);
    });

    it("shows dialog when plant selection + garden/action are present", () => {
      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: {
              ...createDefaultFormState(),
              gardenAddress: MOCK_ADDRESSES.garden,
              actionUID: 1,
              plantSelection: ["oak"],
            },
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.showDraftDialog).toBe(true);
    });
  });

  // ------------------------------------------
  // handleContinueDraft
  // ------------------------------------------

  describe("handleContinueDraft", () => {
    it("hides dialog when continuing with draft", () => {
      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: {
              ...createDefaultFormState(),
              images: [createMockFile()],
            },
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.showDraftDialog).toBe(true);

      act(() => {
        result.current.handleContinueDraft();
      });

      expect(result.current.showDraftDialog).toBe(false);
    });
  });

  // ------------------------------------------
  // handleStartFresh
  // ------------------------------------------

  describe("handleStartFresh", () => {
    it("hides dialog and clears active draft", async () => {
      mockActiveDraftId = "draft-to-clear";

      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: {
              ...createDefaultFormState(),
              images: [createMockFile()],
            },
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.showDraftDialog).toBe(true);

      await act(async () => {
        await result.current.handleStartFresh();
      });

      expect(result.current.showDraftDialog).toBe(false);
      expect(mockClearActiveDraft).toHaveBeenCalled();
    });

    it("does not call clearActiveDraft when no active draft", async () => {
      mockActiveDraftId = null;

      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: {
              ...createDefaultFormState(),
              images: [createMockFile()],
            },
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.handleStartFresh();
      });

      expect(mockClearActiveDraft).not.toHaveBeenCalled();
    });

    it("handles clearActiveDraft errors gracefully", async () => {
      mockActiveDraftId = "draft-error";
      mockClearActiveDraft.mockRejectedValue(new Error("DB error"));

      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: {
              ...createDefaultFormState(),
              images: [createMockFile()],
            },
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      // Should not throw
      await act(async () => {
        await result.current.handleStartFresh();
      });

      // Dialog should still be hidden despite the error
      expect(result.current.showDraftDialog).toBe(false);
    });
  });

  // ------------------------------------------
  // setShowDraftDialog
  // ------------------------------------------

  describe("setShowDraftDialog", () => {
    it("allows manual control of dialog visibility", () => {
      const { result } = renderHook(
        () =>
          useDraftResume({
            formState: createDefaultFormState(),
            isOnIntroTab: true,
            searchParams: new URLSearchParams(),
            setSearchParams: mockSetSearchParams,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      act(() => {
        result.current.setShowDraftDialog(true);
      });

      expect(result.current.showDraftDialog).toBe(true);

      act(() => {
        result.current.setShowDraftDialog(false);
      });

      expect(result.current.showDraftDialog).toBe(false);
    });
  });
});
