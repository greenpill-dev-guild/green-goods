/**
 * @vitest-environment jsdom
 *
 * useWorkApproval Hook Tests
 *
 * Tests for work approval submission with auth mode branching,
 * toast notifications, and job queue integration.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
const mockUseUser = vi.fn();

vi.mock("../../hooks/auth/useUser", () => ({
  useUser: () => mockUseUser(),
}));

vi.mock("../../modules/work/wallet-submission", () => ({
  submitApprovalDirectly: vi.fn(),
}));

vi.mock("../../modules/work/work-submission", () => ({
  submitApprovalToQueue: vi.fn(),
}));

vi.mock("../../modules/job-queue", () => ({
  jobQueue: {
    processJob: vi.fn(),
  },
}));

vi.mock("../../components/toast", () => ({
  toastService: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../modules/app/analytics-events", () => ({
  trackWorkApprovalStarted: vi.fn(),
  trackWorkApprovalSuccess: vi.fn(),
  trackWorkApprovalFailed: vi.fn(),
  trackWorkRejectionSuccess: vi.fn(),
}));

vi.mock("../../utils/app/haptics", () => ({
  hapticSuccess: vi.fn(),
  hapticError: vi.fn(),
}));

// Mock createMutationErrorHandler to simulate the real error handler calling toastService.error
const mockErrorHandler = vi.fn();
vi.mock("../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: vi.fn(() => mockErrorHandler),
}));

vi.mock("../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
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

import { toastService } from "../../components/toast";
import { queryKeys } from "../../config/query-keys";
import { useWorkApproval } from "../../hooks/work/useWorkApproval";
import en from "../../i18n/en.json";
import { jobQueue } from "../../modules/job-queue";
import { submitApprovalDirectly } from "../../modules/work/wallet-submission";
import { submitApprovalToQueue } from "../../modules/work/work-submission";
import { Confidence, VerificationMethod } from "../../types/domain";
import {
  createMockWork,
  createMockWorkApprovalDraft,
  MOCK_ADDRESSES,
  MOCK_TX_HASH,
} from "../test-utils";

const MOCK_CONFIRMED_APPROVAL_RESULT = {
  hash: MOCK_TX_HASH,
  confirmed: true,
};

describe("hooks/work/useWorkApproval", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) =>
      createElement(
        IntlProvider,
        { locale: "en", messages: en },
        createElement(QueryClientProvider, { client: queryClient }, children)
      );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Default: online
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
      writable: true,
    });

    // Default: wallet mode
    mockUseUser.mockReturnValue({
      authMode: "wallet",
      primaryAddress: null,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("Wallet mode", () => {
    it("calls submitApprovalDirectly for wallet users", async () => {
      (submitApprovalDirectly as any).mockResolvedValue(MOCK_CONFIRMED_APPROVAL_RESULT);

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({ approved: true });

      await act(async () => {
        await result.current.mutateAsync({ draft, work });
      });

      expect(submitApprovalDirectly).toHaveBeenCalledWith(
        draft,
        work.gardenAddress,
        work.gardenerAddress,
        11155111
      );
      expect(submitApprovalToQueue).not.toHaveBeenCalled();
    });

    it("does not mutate cached wallet work until the transaction confirms", async () => {
      let releaseSubmission: (() => void) | undefined;
      (submitApprovalDirectly as any).mockImplementation(async () => {
        await new Promise<void>((resolve) => {
          releaseSubmission = resolve;
        });
        return MOCK_CONFIRMED_APPROVAL_RESULT;
      });

      const work = createMockWork({ status: "pending" });
      const draft = createMockWorkApprovalDraft({
        actionUID: work.actionUID,
        workUID: work.id,
        approved: false,
      });
      const workQueryKey = queryKeys.works.merged(work.gardenAddress, 11155111);
      queryClient.setQueryData(workQueryKey, [work]);

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      let approvalPromise!: ReturnType<typeof result.current.mutateAsync>;
      act(() => {
        approvalPromise = result.current.mutateAsync({ draft, work });
      });

      await waitFor(() => {
        expect(submitApprovalDirectly).toHaveBeenCalled();
      });

      expect(queryClient.getQueryData(workQueryKey)).toEqual([work]);

      await act(async () => {
        releaseSubmission?.();
        await approvalPromise;
      });

      expect(queryClient.getQueryData<Array<{ status: string }>>(workQueryKey)?.[0]?.status).toBe(
        "rejected"
      );
    });

    it("records wallet decisions when receipt confirmation times out", async () => {
      (submitApprovalDirectly as any).mockResolvedValue({
        hash: MOCK_TX_HASH,
        confirmed: false,
      });

      const work = createMockWork({ status: "pending" });
      const draft = createMockWorkApprovalDraft({
        actionUID: work.actionUID,
        workUID: work.id,
        approved: true,
      });
      const mergedKey = queryKeys.works.merged(work.gardenAddress, 11155111);
      const onlineKey = queryKeys.works.online(work.gardenAddress, 11155111);
      queryClient.setQueryData(mergedKey, [work]);
      queryClient.setQueryData(onlineKey, [work]);

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ draft, work });
      });

      expect(queryClient.getQueryData<Array<{ status: string }>>(mergedKey)?.[0]?.status).toBe(
        "approved"
      );
      expect(queryClient.getQueryData<Array<{ status: string }>>(onlineKey)?.[0]?.status).toBe(
        "approved"
      );

      const rejectionDraft = createMockWorkApprovalDraft({
        actionUID: work.actionUID,
        workUID: work.id,
        approved: false,
      });
      await act(async () => {
        await result.current.mutateAsync({ draft: rejectionDraft, work });
      });

      expect(queryClient.getQueryData<Array<{ status: string }>>(mergedKey)?.[0]?.status).toBe(
        "rejected"
      );
      expect(queryClient.getQueryData<Array<{ status: string }>>(onlineKey)?.[0]?.status).toBe(
        "rejected"
      );
    });

    it("leaves persisted work state unchanged when the wallet rejects the request", async () => {
      const walletError = new Error("User rejected the request");
      (submitApprovalDirectly as any).mockRejectedValue(walletError);

      const work = createMockWork({ status: "pending" });
      const draft = createMockWorkApprovalDraft({
        actionUID: work.actionUID,
        workUID: work.id,
        approved: false,
      });
      const mergedKey = queryKeys.works.merged(work.gardenAddress, 11155111);
      const onlineKey = queryKeys.works.online(work.gardenAddress, 11155111);
      queryClient.setQueryData(mergedKey, [work]);
      queryClient.setQueryData(onlineKey, [work]);

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await expect(result.current.mutateAsync({ draft, work })).rejects.toThrow(
          "User rejected the request"
        );
      });

      expect(queryClient.getQueryData(mergedKey)).toEqual([work]);
      expect(queryClient.getQueryData(onlineKey)).toEqual([work]);
    });

    it("invalidates recipient-scoped approval reads after wallet approval succeeds", async () => {
      (submitApprovalDirectly as any).mockResolvedValue(MOCK_CONFIRMED_APPROVAL_RESULT);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({ approved: true });

      await act(async () => {
        await result.current.mutateAsync({ draft, work });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.approvals.all });
    });
  });

  describe("Passkey mode", () => {
    it("queues approval and processes inline when online", async () => {
      mockUseUser.mockReturnValue({
        authMode: "passkey",
        primaryAddress: MOCK_ADDRESSES.smartAccount,
      });

      (submitApprovalToQueue as any).mockResolvedValue({
        txHash: "0xoffline_approval",
        jobId: "job-approval-1",
      });

      (jobQueue.processJob as any).mockResolvedValue({
        success: true,
        txHash: MOCK_TX_HASH,
        skipped: false,
      });

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({ approved: true });

      let result_data: { hash: string } | undefined;
      await act(async () => {
        result_data = await result.current.mutateAsync({ draft, work });
      });

      expect(submitApprovalToQueue).toHaveBeenCalledWith(
        draft,
        work,
        11155111,
        MOCK_ADDRESSES.smartAccount
      );
      expect(jobQueue.processJob).toHaveBeenCalledWith("job-approval-1", {
        transactionSender: mockSender,
      });
      expect(result_data?.hash).toBe(MOCK_TX_HASH);
    });

    it("returns offline hash when offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      mockUseUser.mockReturnValue({
        authMode: "passkey",
        primaryAddress: MOCK_ADDRESSES.smartAccount,
      });

      (submitApprovalToQueue as any).mockResolvedValue({
        txHash: "0xoffline_xyz",
        jobId: "job-xyz",
      });

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({ approved: false });

      let result_data: { hash: string } | undefined;
      await act(async () => {
        result_data = await result.current.mutateAsync({ draft, work });
      });

      expect(result_data?.hash).toBe("0xoffline_xyz");
      expect(jobQueue.processJob).not.toHaveBeenCalled();
    });
  });

  describe("Feedback handling", () => {
    it("handles empty feedback correctly", async () => {
      (submitApprovalDirectly as any).mockResolvedValue(MOCK_CONFIRMED_APPROVAL_RESULT);

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({
        approved: true,
        feedback: "", // Empty feedback
      });

      await act(async () => {
        await result.current.mutateAsync({ draft, work });
      });

      expect(submitApprovalDirectly).toHaveBeenCalledWith(
        expect.objectContaining({ feedback: "" }),
        work.gardenAddress,
        work.gardenerAddress,
        11155111
      );
    });

    it("includes feedback for rejection", async () => {
      (submitApprovalDirectly as any).mockResolvedValue(MOCK_CONFIRMED_APPROVAL_RESULT);

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({
        approved: false,
        feedback: "Please improve the planting technique",
      });

      await act(async () => {
        await result.current.mutateAsync({ draft, work });
      });

      expect(submitApprovalDirectly).toHaveBeenCalledWith(
        expect.objectContaining({
          approved: false,
          feedback: "Please improve the planting technique",
        }),
        work.gardenAddress,
        work.gardenerAddress,
        11155111
      );
    });
  });

  describe("Toast notifications", () => {
    it("shows success toast on approval", async () => {
      (submitApprovalDirectly as any).mockResolvedValue(MOCK_CONFIRMED_APPROVAL_RESULT);

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({ approved: true });

      await act(async () => {
        await result.current.mutateAsync({ draft, work });
      });

      await waitFor(() => {
        expect(toastService.success).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "approval-submit",
            message: "Transaction confirmed.",
          })
        );
      });
    });

    it("shows error toast on failure", async () => {
      const error = new Error("Approval failed");
      (submitApprovalDirectly as any).mockRejectedValue(error);

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({ approved: true });

      await act(async () => {
        try {
          await result.current.mutateAsync({ draft, work });
        } catch {
          // Expected to throw
        }
      });

      // Error handling is now delegated to createMutationErrorHandler
      expect(mockErrorHandler).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          authMode: "wallet",
        })
      );
    });
  });

  describe("Confidence and verification data flow", () => {
    it("passes confidence through queue for passkey approval", async () => {
      mockUseUser.mockReturnValue({
        authMode: "passkey",
        primaryAddress: MOCK_ADDRESSES.smartAccount,
      });

      (submitApprovalToQueue as any).mockResolvedValue({
        txHash: "0xoffline_conf_test",
        jobId: "job-conf-1",
      });

      (jobQueue.processJob as any).mockResolvedValue({
        success: true,
        txHash: MOCK_TX_HASH,
        skipped: false,
      });

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({
        approved: true,
        confidence: Confidence.HIGH,
        verificationMethod: VerificationMethod.HUMAN,
      });

      await act(async () => {
        await result.current.mutateAsync({ draft, work });
      });

      // Verify the full draft with confidence is passed to the queue
      expect(submitApprovalToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: Confidence.HIGH,
          verificationMethod: VerificationMethod.HUMAN,
          approved: true,
        }),
        work,
        11155111,
        MOCK_ADDRESSES.smartAccount
      );
    });

    it("passes NONE confidence for rejection via queue", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      mockUseUser.mockReturnValue({
        authMode: "passkey",
        primaryAddress: MOCK_ADDRESSES.smartAccount,
      });

      (submitApprovalToQueue as any).mockResolvedValue({
        txHash: "0xoffline_reject",
        jobId: "job-reject-1",
      });

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({
        approved: false,
        confidence: Confidence.NONE,
        verificationMethod: VerificationMethod.HUMAN,
        feedback: "Work not meeting standards",
      });

      await act(async () => {
        await result.current.mutateAsync({ draft, work });
      });

      expect(submitApprovalToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: Confidence.NONE,
          verificationMethod: VerificationMethod.HUMAN,
          approved: false,
          feedback: "Work not meeting standards",
        }),
        work,
        11155111,
        MOCK_ADDRESSES.smartAccount
      );
      // Offline: processJob should not be called
      expect(jobQueue.processJob).not.toHaveBeenCalled();
    });

    it("passes confidence through wallet direct submission", async () => {
      (submitApprovalDirectly as any).mockResolvedValue(MOCK_CONFIRMED_APPROVAL_RESULT);

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({
        approved: true,
        confidence: Confidence.LOW,
        verificationMethod: VerificationMethod.HUMAN,
      });

      await act(async () => {
        await result.current.mutateAsync({ draft, work });
      });

      expect(submitApprovalDirectly).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: Confidence.LOW,
          verificationMethod: VerificationMethod.HUMAN,
        }),
        work.gardenAddress,
        work.gardenerAddress,
        11155111
      );
    });

    it("includes reviewNotesCID when provided", async () => {
      mockUseUser.mockReturnValue({
        authMode: "passkey",
        primaryAddress: MOCK_ADDRESSES.smartAccount,
      });

      (submitApprovalToQueue as any).mockResolvedValue({
        txHash: "0xoffline_notes",
        jobId: "job-notes-1",
      });

      (jobQueue.processJob as any).mockResolvedValue({
        success: true,
        txHash: MOCK_TX_HASH,
        skipped: false,
      });

      const { result } = renderHook(() => useWorkApproval(), {
        wrapper: createWrapper(),
      });

      const work = createMockWork();
      const draft = createMockWorkApprovalDraft({
        approved: true,
        confidence: Confidence.MEDIUM,
        verificationMethod: VerificationMethod.HUMAN,
        reviewNotesCID: "bafyReviewNotes123",
      });

      await act(async () => {
        await result.current.mutateAsync({ draft, work });
      });

      expect(submitApprovalToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: Confidence.MEDIUM,
          verificationMethod: VerificationMethod.HUMAN,
          reviewNotesCID: "bafyReviewNotes123",
        }),
        work,
        11155111,
        MOCK_ADDRESSES.smartAccount
      );
    });
  });
});
