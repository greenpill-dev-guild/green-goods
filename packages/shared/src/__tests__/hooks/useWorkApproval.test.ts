/**
 * useWorkApproval Hook Tests
 *
 * Tests for work approval submission with auth mode branching,
 * toast notifications, and job queue integration.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
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
  DEFAULT_CHAIN_ID: 84532,
}));

vi.mock("../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}));

import { submitApprovalDirectly } from "../../modules/work/wallet-submission";
import { submitApprovalToQueue } from "../../modules/work/work-submission";
import { jobQueue } from "../../modules/job-queue";
import { toastService } from "../../components/toast";
import { useWorkApproval } from "../../hooks/work/useWorkApproval";
import {
  createMockWork,
  createMockWorkApprovalDraft,
  createMockSmartAccountClient,
  MOCK_ADDRESSES,
  MOCK_TX_HASH,
} from "../test-utils";

describe("hooks/work/useWorkApproval", () => {
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

    // Default: online
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
      writable: true,
    });

    // Default: wallet mode
    mockUseUser.mockReturnValue({
      authMode: "wallet",
      smartAccountClient: null,
      smartAccountAddress: null,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("Wallet mode", () => {
    it("calls submitApprovalDirectly for wallet users", async () => {
      (submitApprovalDirectly as any).mockResolvedValue(MOCK_TX_HASH);

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
        84532
      );
      expect(submitApprovalToQueue).not.toHaveBeenCalled();
    });
  });

  describe("Passkey mode", () => {
    it("queues approval and processes inline when online", async () => {
      const smartAccountClient = createMockSmartAccountClient();

      mockUseUser.mockReturnValue({
        authMode: "passkey",
        smartAccountClient,
        smartAccountAddress: MOCK_ADDRESSES.smartAccount,
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
        84532,
        MOCK_ADDRESSES.smartAccount
      );
      expect(jobQueue.processJob).toHaveBeenCalledWith("job-approval-1", {
        smartAccountClient,
      });
      expect(result_data?.hash).toBe(MOCK_TX_HASH);
    });

    it("returns offline hash when offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });

      mockUseUser.mockReturnValue({
        authMode: "passkey",
        smartAccountClient: createMockSmartAccountClient(),
        smartAccountAddress: MOCK_ADDRESSES.smartAccount,
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
      (submitApprovalDirectly as any).mockResolvedValue(MOCK_TX_HASH);

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
        84532
      );
    });

    it("includes feedback for rejection", async () => {
      (submitApprovalDirectly as any).mockResolvedValue(MOCK_TX_HASH);

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
        84532
      );
    });
  });

  describe("Toast notifications", () => {
    it("shows success toast on approval", async () => {
      (submitApprovalDirectly as any).mockResolvedValue(MOCK_TX_HASH);

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

      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "approval-submit",
          title: "Approval failed",
        })
      );
    });
  });
});
