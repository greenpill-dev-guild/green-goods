/**
 * @vitest-environment jsdom
 *
 * useWorkMutation Hook Tests
 *
 * Tests for work submission mutation with auth mode branching,
 * online/offline detection, and job queue integration.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workMutationStoreMocks = vi.hoisted(() => ({
  openWorkDashboard: vi.fn(),
  setSubmissionCompleted: vi.fn(),
  ensureWorkSubmissionJourneyId: vi.fn(() => "journey-123"),
}));

// Mock modules
vi.mock("../../modules/work/wallet-submission", () => ({
  submitWorkDirectly: vi.fn(),
}));

vi.mock("../../modules/work/work-submission", () => ({
  submitWorkToQueue: vi.fn(),
}));

vi.mock("../../modules/job-queue", () => ({
  jobQueue: {
    processJob: vi.fn(),
  },
}));

vi.mock("../../modules/work/simulate", () => ({
  simulateWorkSubmission: vi.fn(),
}));

vi.mock("../../components/toast", () => ({
  toastService: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
  workToasts: {
    submitting: vi.fn(),
    savedOffline: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
  walletProgressToasts: {
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
  showWalletProgress: vi.fn(),
}));

vi.mock("../../stores/useUIStore", () => ({
  useUIStore: vi.fn(() => workMutationStoreMocks.openWorkDashboard),
}));

vi.mock("../../stores/useWorkFlowStore", () => ({
  useWorkFlowStore: {
    getState: vi.fn(() => ({
      setSubmissionCompleted: workMutationStoreMocks.setSubmissionCompleted,
      ensureWorkSubmissionJourneyId: workMutationStoreMocks.ensureWorkSubmissionJourneyId,
    })),
  },
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../utils/action/parsers", () => ({
  getActionTitle: vi.fn(() => "Test Action"),
}));

vi.mock("../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock("../../modules/app/error-tracking", () => ({
  trackContractError: vi.fn(),
  trackUploadError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("../../modules/app/analytics-events", () => ({
  trackWorkSubmissionStarted: vi.fn(),
  trackWorkSubmissionSuccess: vi.fn(),
  trackWorkSubmissionFailed: vi.fn(),
  trackWorkWalletRequestStarted: vi.fn(),
  trackWorkWalletRequestExpired: vi.fn(),
  trackWorkWalletRequestFailed: vi.fn(),
}));

// Mock useTransactionSender to avoid wagmi provider dependency
const mockSender = {
  sendContractCall: vi.fn().mockResolvedValue({ hash: "0xabc123", sponsored: true }),
  supportsSponsorship: true,
  supportsBatching: false,
  authMode: "passkey" as const,
};

vi.mock("../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: vi.fn(() => mockSender),
}));

vi.mock("../../utils/errors/contract-errors", () => ({
  parseContractError: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("request expired")) {
      return {
        raw: message,
        name: "WalletRequestExpired",
        message: "Wallet request expired before it was confirmed.",
        action: "Submit again from Review when you're ready.",
        isKnown: true,
        recoverable: true,
        suggestedAction: "retry",
      };
    }
    return {
      raw: message,
      name: "UnknownError",
      message: "Something went wrong",
      isKnown: false,
      recoverable: true,
      suggestedAction: "retry",
    };
  }),
  parseAndFormatError: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("request expired")) {
      return {
        title: "Wallet Request Expired",
        message:
          "Wallet request expired before it was confirmed. Submit again from Review when you're ready.",
        parsed: {
          raw: message,
          name: "WalletRequestExpired",
          message: "Wallet request expired before it was confirmed.",
          action: "Submit again from Review when you're ready.",
          isKnown: true,
          recoverable: true,
          suggestedAction: "retry",
        },
      };
    }
    return {
      title: "Error",
      message: "Something went wrong",
      parsed: { isKnown: false, name: "UnknownError", recoverable: true },
    };
  }),
  isNotGardenMemberError: vi.fn(() => false),
  isAlreadyGardenerError: vi.fn(() => false),
  formatErrorForToast: vi.fn(() => ({ title: "Error", message: "Something went wrong" })),
}));

import { walletProgressToasts, workToasts } from "../../components/toast";
import { useWorkMutation } from "../../hooks/work/useWorkMutation";
import { jobQueue } from "../../modules/job-queue";
import { submitWorkDirectly } from "../../modules/work/wallet-submission";
import { WorkSubmissionError } from "../../modules/work/wallet-submission/types";
import { submitWorkToQueue } from "../../modules/work/work-submission";
import {
  trackWorkWalletRequestExpired,
  trackWorkWalletRequestStarted,
} from "../../modules/app/analytics-events";
import {
  createMockAction,
  createMockFiles,
  createMockWorkDraft,
  MOCK_ADDRESSES,
  MOCK_TX_HASH,
  mock,
} from "../test-utils";

describe("hooks/work/useWorkMutation", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    workMutationStoreMocks.ensureWorkSubmissionJourneyId.mockReturnValue("journey-123");

    // Default: online
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const defaultOptions = {
    authMode: "wallet" as const,
    gardenAddress: MOCK_ADDRESSES.garden,
    actionUID: 1,
    actions: [createMockAction({ id: "1" })],
    userAddress: MOCK_ADDRESSES.user,
  };

  describe("Wallet mode - online", () => {
    it("calls submitWorkDirectly when online", async () => {
      mock(submitWorkDirectly).mockResolvedValue(MOCK_TX_HASH);

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      const draft = createMockWorkDraft();
      const images = createMockFiles(2);

      await act(async () => {
        await result.current.mutateAsync({ draft, images });
      });

      expect(submitWorkDirectly).toHaveBeenCalledWith(
        draft,
        MOCK_ADDRESSES.garden,
        1,
        "Test Action",
        11155111,
        images,
        expect.objectContaining({ onProgress: expect.any(Function) })
      );
      expect(submitWorkToQueue).not.toHaveBeenCalled();
    });

    it("tracks when the wallet request starts", async () => {
      mock(submitWorkDirectly).mockImplementation(
        async (_draft, _garden, _actionUID, _actionTitle, _chainId, _images, options) => {
          options?.onProgress?.("confirming", "Confirm in your wallet...");
          return MOCK_TX_HASH;
        }
      );

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          draft: createMockWorkDraft(),
          images: createMockFiles(2),
        });
      });

      expect(trackWorkWalletRequestStarted).toHaveBeenCalledWith(
        expect.objectContaining({
          workSubmissionJourneyId: "journey-123",
          authMode: "wallet",
          chainId: 11155111,
          actionUID: 1,
          imageCount: 2,
          submissionPhase: "wallet_request",
        })
      );
    });

    it("exposes wallet progress to reusable hook consumers", async () => {
      const onProgress = vi.fn();
      mock(submitWorkDirectly).mockImplementation(
        async (_draft, _garden, _actionUID, _actionTitle, _chainId, _images, options) => {
          options?.onProgress?.("uploading", "Uploading media to IPFS...");
          return MOCK_TX_HASH;
        }
      );

      const { result } = renderHook(() => useWorkMutation({ ...defaultOptions, onProgress }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          draft: createMockWorkDraft(),
          images: createMockFiles(1),
        });
      });

      expect(onProgress).toHaveBeenCalledWith("uploading", "Uploading media to IPFS...");
    });

    it("lets admin-style consumers opt out of client completion side effects", async () => {
      const onSuccess = vi.fn();
      const onSettled = vi.fn();
      mock(submitWorkDirectly).mockResolvedValue(MOCK_TX_HASH);

      const { result } = renderHook(
        () =>
          useWorkMutation({
            ...defaultOptions,
            completeClientFlow: false,
            onSuccess,
            onSettled,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.mutateAsync({
          draft: createMockWorkDraft(),
          images: createMockFiles(1),
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(MOCK_TX_HASH);
      expect(onSettled).toHaveBeenCalled();
      expect(workMutationStoreMocks.setSubmissionCompleted).not.toHaveBeenCalled();
      expect(workMutationStoreMocks.openWorkDashboard).not.toHaveBeenCalled();
    });
  });

  describe("Wallet mode - offline", () => {
    it("queues via submitWorkToQueue when offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      mock(submitWorkToQueue).mockResolvedValue({
        txHash: "0xoffline_123",
        jobId: "job-123",
        clientWorkId: "work-123",
      });

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      const draft = createMockWorkDraft();
      const images = createMockFiles(1);

      await act(async () => {
        await result.current.mutateAsync({ draft, images });
      });

      expect(submitWorkToQueue).toHaveBeenCalled();
      expect(submitWorkDirectly).not.toHaveBeenCalled();
      expect(workToasts.savedOffline).toHaveBeenCalled();
    });
  });

  describe("Passkey mode - online", () => {
    it("queues and processes inline when online with smart account", async () => {
      mock(submitWorkToQueue).mockResolvedValue({
        txHash: "0xoffline_abc",
        jobId: "job-abc",
        clientWorkId: "work-abc",
      });

      mock(jobQueue.processJob).mockResolvedValue({
        success: true,
        txHash: MOCK_TX_HASH,
        skipped: false,
      });

      const { result } = renderHook(
        () =>
          useWorkMutation({
            ...defaultOptions,
            authMode: "passkey",
            userAddress: MOCK_ADDRESSES.smartAccount,
          }),
        { wrapper: createWrapper() }
      );

      const draft = createMockWorkDraft();
      const images = createMockFiles(1);

      let txHash: string | undefined;
      await act(async () => {
        txHash = await result.current.mutateAsync({ draft, images });
      });

      expect(submitWorkToQueue).toHaveBeenCalled();
      expect(jobQueue.processJob).toHaveBeenCalledWith("job-abc", {
        transactionSender: mockSender,
      });
      expect(txHash).toBe(MOCK_TX_HASH);
    });
  });

  describe("Passkey mode - offline", () => {
    it("queues without processing when offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      mock(submitWorkToQueue).mockResolvedValue({
        txHash: "0xoffline_xyz",
        jobId: "job-xyz",
        clientWorkId: "work-xyz",
      });

      const { result } = renderHook(
        () =>
          useWorkMutation({
            ...defaultOptions,
            authMode: "passkey",
            userAddress: MOCK_ADDRESSES.smartAccount,
          }),
        { wrapper: createWrapper() }
      );

      const draft = createMockWorkDraft();
      const images = createMockFiles(1);

      let txHash: string | undefined;
      await act(async () => {
        txHash = await result.current.mutateAsync({ draft, images });
      });

      expect(submitWorkToQueue).toHaveBeenCalled();
      expect(jobQueue.processJob).not.toHaveBeenCalled();
      expect(txHash).toBe("0xoffline_xyz");
    });
  });

  describe("Success handling", () => {
    it("shows success toast for wallet mode", async () => {
      // Mock submitWorkDirectly to call the onProgress callback with "complete"
      mock(submitWorkDirectly).mockImplementation(
        async (_draft, _garden, _actionUID, _actionTitle, _chainId, _images, options) => {
          // Simulate the wallet submission calling onProgress("complete")
          if (options?.onProgress) {
            options.onProgress("complete");
          }
          return MOCK_TX_HASH;
        }
      );

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          draft: createMockWorkDraft(),
          images: [],
        });
      });

      // Wallet mode uses walletProgressToasts.success() via onProgress("complete") callback
      await waitFor(() => {
        expect(walletProgressToasts.success).toHaveBeenCalled();
      });
    });

    it("returns offline hash for queued work", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      mock(submitWorkToQueue).mockResolvedValue({
        txHash: "0xoffline_queued",
        jobId: "job-q",
        clientWorkId: "work-q",
      });

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      let txHash: string | undefined;
      await act(async () => {
        txHash = await result.current.mutateAsync({
          draft: createMockWorkDraft(),
          images: [],
        });
      });

      expect(txHash).toBe("0xoffline_queued");
      expect(txHash?.startsWith("0xoffline_")).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("shows error toast on submission failure", async () => {
      const error = new Error("Submission failed");
      mock(submitWorkDirectly).mockRejectedValue(error);

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            draft: createMockWorkDraft(),
            images: [],
          });
        } catch {
          // Expected to throw
        }
      });

      // Wait for error state to be set
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("does NOT fall back to queue for upload-phase errors (IPFS failures)", async () => {
      // Simulate an IPFS upload failure — the error message contains "gateway"/"timeout"
      // which would previously match isNetworkError and silently queue the work.
      const uploadError = new WorkSubmissionError(
        "Transaction timed out - please try again",
        "upload",
        "batch-123",
        new Error("Failed to verify Pinata gateway availability: 504 Gateway Timeout")
      );
      mock(submitWorkDirectly).mockRejectedValue(uploadError);

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            draft: createMockWorkDraft(),
            images: createMockFiles(1),
          });
        } catch {
          // Expected to throw — upload errors should surface, not silently queue
        }
      });

      // The error should propagate to onError, NOT fall back to queue
      expect(submitWorkToQueue).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("falls back to queue for transaction-phase network errors", async () => {
      // Simulate a genuine network error during the transaction phase
      const txError = new WorkSubmissionError(
        "Network error - please check your connection",
        "transaction",
        "batch-456",
        new Error("network connection failed")
      );
      mock(submitWorkDirectly).mockRejectedValue(txError);
      mock(submitWorkToQueue).mockResolvedValue({
        txHash: "0xoffline_fallback",
        jobId: "job-fallback",
        clientWorkId: "work-fallback",
      });

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      let txHash: string | undefined;
      await act(async () => {
        txHash = await result.current.mutateAsync({
          draft: createMockWorkDraft(),
          images: createMockFiles(1),
        });
      });

      // Transaction-phase network errors SHOULD fall back to queue
      expect(submitWorkToQueue).toHaveBeenCalled();
      expect(txHash).toBe("0xoffline_fallback");
    });

    it("keeps wallet request expiry on the direct Review retry path", async () => {
      const expiredError = new WorkSubmissionError(
        "Wallet request expired",
        "transaction",
        "batch-expired",
        new Error("request expired")
      );
      mock(submitWorkDirectly).mockRejectedValue(expiredError);

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            draft: createMockWorkDraft(),
            images: createMockFiles(2),
          });
        } catch {
          // Expected to throw so the Review step can keep the same draft state.
        }
      });

      expect(submitWorkToQueue).not.toHaveBeenCalled();
      expect(trackWorkWalletRequestExpired).toHaveBeenCalledWith(
        expect.objectContaining({
          workSubmissionJourneyId: "journey-123",
          authMode: "wallet",
          chainId: 11155111,
          actionUID: 1,
          imageCount: 2,
          submissionPhase: "transaction",
          parsedErrorFamily: "WalletRequestExpired",
        })
      );
      expect(walletProgressToasts.error).toHaveBeenCalledWith(
        expect.stringContaining("Wallet request expired"),
        true
      );
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("inserts optimistic entry when wallet submission falls back to queue", async () => {
      // Simulate a transaction-phase network error that triggers queue fallback
      const txError = new WorkSubmissionError(
        "Network error - please check your connection",
        "transaction",
        "batch-789",
        new Error("network timeout")
      );
      mock(submitWorkDirectly).mockRejectedValue(txError);
      mock(submitWorkToQueue).mockResolvedValue({
        txHash: "0xoffline_optimistic",
        jobId: "job-opt",
        clientWorkId: "work-opt",
      });

      const { result } = renderHook(() => useWorkMutation(defaultOptions), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          draft: createMockWorkDraft(),
          images: createMockFiles(1),
        });
      });

      // Check that an optimistic entry was inserted into the merged works cache
      const mergedWorks = queryClient.getQueryData<Array<{ id: string; status?: string }>>([
        "greengoods",
        "works",
        "merged",
        MOCK_ADDRESSES.garden,
        11155111,
      ]);

      expect(mergedWorks).toBeDefined();
      expect(mergedWorks!.length).toBeGreaterThan(0);
      expect(mergedWorks![0].id).toMatch(/^0xoffline_optimistic_/);
      expect(mergedWorks![0].status).toBe("pending");
    });
  });
});
