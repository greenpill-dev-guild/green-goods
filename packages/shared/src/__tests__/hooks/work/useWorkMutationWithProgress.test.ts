/**
 * useWorkMutationWithProgress Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the combined work mutation + progress tracking hook.
 * Covers progress state management during submission, error handling,
 * wallet stage mapping, and reset behavior.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockAction,
  createMockFiles,
  createMockWorkDraft,
  MOCK_ADDRESSES,
} from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

const mockMutateAsync = vi.fn();
const mockMutationReset = vi.fn();

vi.mock("../../../hooks/work/useWorkMutation", () => ({
  useWorkMutation: () => ({
    mutateAsync: mockMutateAsync,
    reset: mockMutationReset,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  }),
}));

// We let useSubmissionProgress run its real implementation since it's pure React state
// This tests the integration between the two hooks

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackContractError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    authMode: "wallet",
    primaryAddress: MOCK_ADDRESSES.user,
  }),
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => MOCK_ADDRESSES.user,
}));

vi.mock("../../../components/toast", () => ({
  toastService: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  parseAndFormatError: vi.fn(() => ({
    title: "Error",
    message: "Something went wrong",
    parsed: { name: "UnknownError", message: "err", isKnown: false, recoverable: false },
  })),
}));

vi.mock("../../../utils/app/haptics", () => ({
  hapticError: vi.fn(),
  hapticSuccess: vi.fn(),
}));

vi.mock("../../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
}));

import { useWorkMutationWithProgress } from "../../../hooks/work/useWorkMutationWithProgress";

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

function createDefaultOptions() {
  return {
    authMode: "wallet" as const,
    gardenAddress: MOCK_ADDRESSES.garden as `0x${string}`,
    actionUID: 1,
    actions: [createMockAction()],
    userAddress: MOCK_ADDRESSES.user as `0x${string}`,
  };
}

// ============================================
// Tests
// ============================================

describe("useWorkMutationWithProgress", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockMutateAsync.mockResolvedValue({ hash: "0xabc", uid: "0x123" });
  });

  // ------------------------------------------
  // Initial state
  // ------------------------------------------

  describe("initial state", () => {
    it("starts with idle progress", () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.progress.stage).toBe("idle");
      expect(result.current.progress.overallProgress).toBe(0);
      expect(result.current.isInProgress).toBe(false);
      expect(result.current.isPending).toBe(false);
    });

    it("exposes mutation, progress, and convenience methods", () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.mutation).toBeDefined();
      expect(result.current.progress).toBeDefined();
      expect(result.current.submitWork).toBeDefined();
      expect(result.current.reset).toBeDefined();
      expect(result.current.setStage).toBeDefined();
      expect(result.current.setStageProgress).toBeDefined();
      expect(result.current.updateProgress).toBeDefined();
    });
  });

  // ------------------------------------------
  // submitWork — successful flow
  // ------------------------------------------

  describe("submitWork", () => {
    it("transitions progress through stages on successful submission", async () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      const draft = createMockWorkDraft();
      const images = createMockFiles(2);

      await act(async () => {
        await result.current.submitWork({ draft, images });
      });

      // Should end at "complete" stage
      expect(result.current.progress.stage).toBe("complete");
      expect(result.current.progress.overallProgress).toBe(100);
    });

    it("resets progress before each new submission", async () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      // Manually set an error state first
      act(() => {
        result.current.setStage("uploading");
        result.current.setStageProgress(50);
      });

      expect(result.current.progress.stage).toBe("uploading");

      // submitWork should reset before starting
      await act(async () => {
        await result.current.submitWork({
          draft: createMockWorkDraft(),
          images: createMockFiles(3),
        });
      });

      // Should end at complete (after reset + compressing + mutateAsync + complete)
      expect(result.current.progress.stage).toBe("complete");
    });

    it("calls mutation.mutateAsync with draft and images", async () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      const draft = createMockWorkDraft({ feedback: "My work" });
      const images = createMockFiles(1);

      await act(async () => {
        await result.current.submitWork({ draft, images });
      });

      expect(mockMutateAsync).toHaveBeenCalledWith({ draft, images });
    });

    it("returns mutation result on success", async () => {
      const expectedResult = { hash: "0xTxHash", uid: "0xUID" };
      mockMutateAsync.mockResolvedValue(expectedResult);

      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      let submitResult: any;
      await act(async () => {
        submitResult = await result.current.submitWork({
          draft: createMockWorkDraft(),
          images: [],
        });
      });

      expect(submitResult).toEqual(expectedResult);
    });
  });

  // ------------------------------------------
  // submitWork — error flow
  // ------------------------------------------

  describe("submitWork error handling", () => {
    it("sets error state when mutation fails", async () => {
      mockMutateAsync.mockRejectedValue(new Error("Upload failed"));

      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitWork({
            draft: createMockWorkDraft(),
            images: createMockFiles(1),
          });
        } catch {
          // Expected
        }
      });

      expect(result.current.progress.stage).toBe("error");
      expect(result.current.progress.error).toBe("Upload failed");
      expect(result.current.isInProgress).toBe(false);
    });

    it("re-throws mutation error for caller handling", async () => {
      const error = new Error("Gas estimation failed");
      mockMutateAsync.mockRejectedValue(error);

      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      await expect(
        act(async () => {
          await result.current.submitWork({
            draft: createMockWorkDraft(),
            images: [],
          });
        })
      ).rejects.toThrow("Gas estimation failed");
    });

    it("uses generic message for non-Error throws", async () => {
      mockMutateAsync.mockRejectedValue("string error");

      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.submitWork({
            draft: createMockWorkDraft(),
            images: [],
          });
        } catch {
          // Expected
        }
      });

      expect(result.current.progress.error).toBe("Submission failed");
    });
  });

  // ------------------------------------------
  // updateProgress (wallet stage mapping)
  // ------------------------------------------

  describe("updateProgress (wallet stage mapping)", () => {
    it("maps 'validating' to 'compressing'", () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.updateProgress("validating");
      });

      expect(result.current.progress.stage).toBe("compressing");
    });

    it("maps 'uploading' to 'uploading'", () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.updateProgress("uploading");
      });

      expect(result.current.progress.stage).toBe("uploading");
    });

    it("maps 'confirming' to 'confirming'", () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.updateProgress("confirming");
      });

      expect(result.current.progress.stage).toBe("confirming");
    });

    it("maps 'syncing' to 'syncing'", () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.updateProgress("syncing");
      });

      expect(result.current.progress.stage).toBe("syncing");
    });

    it("maps 'complete' to 'complete'", () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.updateProgress("complete");
      });

      expect(result.current.progress.stage).toBe("complete");
    });

    it("maps unknown stages to 'idle'", () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.updateProgress("unknown-stage");
      });

      expect(result.current.progress.stage).toBe("idle");
    });
  });

  // ------------------------------------------
  // reset
  // ------------------------------------------

  describe("reset", () => {
    it("resets both mutation and progress state", async () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      // Advance progress
      act(() => {
        result.current.setStage("uploading");
      });

      expect(result.current.progress.stage).toBe("uploading");

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.progress.stage).toBe("idle");
      expect(result.current.progress.overallProgress).toBe(0);
      expect(mockMutationReset).toHaveBeenCalled();
    });

    it("can submit again after reset", async () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      // First submission
      await act(async () => {
        await result.current.submitWork({
          draft: createMockWorkDraft(),
          images: [],
        });
      });

      expect(result.current.progress.stage).toBe("complete");

      // Reset
      act(() => {
        result.current.reset();
      });

      // Second submission
      await act(async () => {
        await result.current.submitWork({
          draft: createMockWorkDraft(),
          images: [],
        });
      });

      expect(result.current.progress.stage).toBe("complete");
      expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    });
  });

  // ------------------------------------------
  // setStageProgress
  // ------------------------------------------

  describe("setStageProgress", () => {
    it("allows direct stage progress updates", () => {
      const { result } = renderHook(() => useWorkMutationWithProgress(createDefaultOptions()), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.setStage("uploading");
      });

      act(() => {
        result.current.setStageProgress(50);
      });

      expect(result.current.progress.stageProgress).toBe(50);
      expect(result.current.progress.overallProgress).toBeGreaterThan(0);
    });
  });
});
