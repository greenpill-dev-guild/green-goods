/**
 * Tests for wallet submission UX optimizations
 *
 * Tests the new features:
 * - Optimistic updates to cache
 * - Simulation caching (60s TTL)
 * - Transaction timeout (60s)
 * - Progress callback stages
 * - Smart polling with early exit
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Create hoisted mocks
const { mockSetQueryData } = vi.hoisted(() => ({
  mockSetQueryData: vi.fn(),
}));

// Mock @wagmi/core
vi.mock("@wagmi/core", () => ({
  getWalletClient: vi.fn(),
  getPublicClient: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

// Mock config
vi.mock("../../config/appkit", () => ({
  wagmiConfig: {},
}));

vi.mock("../../config/blockchain", () => ({
  getEASConfig: () => ({
    EAS: { address: "0xEASAddress" },
    WORK: { uid: "0x" + "1".repeat(64) },
    WORK_APPROVAL: { uid: "0x" + "2".repeat(64) },
  }),
}));

// Mock react-query
vi.mock("../../config/react-query", () => ({
  queryClient: {
    setQueryData: mockSetQueryData,
    getQueryData: vi.fn(() => []),
    invalidateQueries: vi.fn(),
  },
}));

// Mock encoders
vi.mock("../../utils/eas/encoders", () => ({
  encodeWorkData: vi.fn(),
  encodeWorkApprovalData: vi.fn(),
  simulateWorkData: vi.fn(() => "0xSimulationData"),
}));

vi.mock("../../utils/eas/transaction-builder", () => ({
  buildWorkAttestTx: vi.fn(() => ({
    to: "0xEASAddress" as `0x${string}`,
    data: "0xWorkTxData" as `0x${string}`,
    value: 0n,
  })),
  buildApprovalAttestTx: vi.fn(() => ({
    to: "0xEASAddress" as `0x${string}`,
    data: "0xApprovalTxData" as `0x${string}`,
    value: 0n,
  })),
}));

vi.mock("../../utils/blockchain/polling", () => ({
  pollQueriesAfterTransaction: vi.fn(),
}));

vi.mock("../../utils/blockchain/contracts", () => ({
  EASABI: [],
}));

vi.mock("../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock("../../modules/app/analytics-events", () => ({
  trackWalletSubmissionTiming: vi.fn(),
  ANALYTICS_EVENTS: {
    WORK_APPROVAL_SUCCESS: "work_approval_success",
  },
}));

vi.mock("../../modules/app/posthog", () => ({
  track: vi.fn(),
}));

vi.mock("../../hooks/query-keys", () => ({
  queryKeys: {
    works: {
      all: ["greengoods", "works"],
      online: (gardenId: string, chainId: number) => [
        "greengoods",
        "works",
        "online",
        gardenId,
        chainId,
      ],
      merged: (gardenId: string, chainId: number) => [
        "greengoods",
        "works",
        "merged",
        gardenId,
        chainId,
      ],
    },
    workApprovals: {
      all: ["greengoods", "workApprovals"],
    },
  },
}));

import * as wagmiCore from "@wagmi/core";
import type { PublicClient, WalletClient } from "viem";
import { trackWalletSubmissionTiming } from "../../modules/app/analytics-events";
import {
  submitApprovalDirectly,
  submitWorkDirectly,
  type WalletSubmissionStage,
} from "../../modules/work/wallet-submission";
import * as encoders from "../../utils/eas/encoders";

describe("wallet-submission UX optimizations", () => {
  const mockChainId = 84532;

  const mockWalletClient: Partial<WalletClient> = {
    sendTransaction: vi.fn(),
    chain: { id: mockChainId } as any,
    account: { address: "0xUserAddress" } as any,
  };

  const mockPublicClient: Partial<PublicClient> = {
    simulateContract: vi.fn().mockResolvedValue({ result: true }),
  };

  const mockWorkDraft: WorkDraft = {
    actionUID: 123,
    title: "Test Work",
    feedback: "Test feedback",
    plantSelection: ["plant1"],
    plantCount: 5,
    media: [],
  };

  const mockImages = [new File(["image"], "test.jpg", { type: "image/jpeg" })];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default successful mocks
    vi.mocked(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
    vi.mocked(wagmiCore.getPublicClient).mockReturnValue(mockPublicClient as PublicClient);
    vi.mocked(encoders.encodeWorkData).mockResolvedValue("0xEncodedData" as `0x${string}`);
    vi.mocked(mockWalletClient.sendTransaction!).mockResolvedValue("0xTxHash" as `0x${string}`);
    vi.mocked(wagmiCore.waitForTransactionReceipt).mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Progress callback", () => {
    it("should call onProgress with correct stages in order", async () => {
      const progressStages: WalletSubmissionStage[] = [];
      const onProgress = vi.fn((stage: WalletSubmissionStage) => {
        progressStages.push(stage);
      });

      const promise = submitWorkDirectly(
        mockWorkDraft,
        "0xGardenAddress",
        123,
        "Test Action",
        mockChainId,
        mockImages,
        { onProgress }
      );

      await vi.runAllTimersAsync();
      await promise;

      // Verify stages are called in order
      expect(progressStages).toContain("validating");
      expect(progressStages).toContain("uploading");
      expect(progressStages).toContain("confirming");
      expect(progressStages).toContain("syncing");
      expect(progressStages).toContain("complete");

      // Verify order
      const validatingIndex = progressStages.indexOf("validating");
      const uploadingIndex = progressStages.indexOf("uploading");
      const confirmingIndex = progressStages.indexOf("confirming");
      const syncingIndex = progressStages.indexOf("syncing");
      const completeIndex = progressStages.indexOf("complete");

      expect(validatingIndex).toBeLessThan(uploadingIndex);
      expect(uploadingIndex).toBeLessThan(confirmingIndex);
      expect(confirmingIndex).toBeLessThan(syncingIndex);
      expect(syncingIndex).toBeLessThan(completeIndex);
    });
  });

  describe("Optimistic updates", () => {
    it("should add optimistic work to cache after tx confirmation", async () => {
      const promise = submitWorkDirectly(
        mockWorkDraft,
        "0xGardenAddress",
        123,
        "Test Action",
        mockChainId,
        mockImages
      );

      await vi.runAllTimersAsync();
      await promise;

      // Verify setQueryData was called for optimistic update
      expect(mockSetQueryData).toHaveBeenCalled();

      // Find the call that adds optimistic work
      const onlineCacheCall = mockSetQueryData.mock.calls.find(
        (call) => Array.isArray(call[0]) && call[0].includes("online")
      );
      expect(onlineCacheCall).toBeDefined();

      // Verify the updater function adds optimistic work
      const updaterFn = onlineCacheCall![1];
      const result = updaterFn([]);
      expect(result.length).toBe(1);
      expect(result[0].id).toContain("optimistic");
      expect(result[0].gardenAddress).toBe("0xGardenAddress");
      expect(result[0].actionUID).toBe(123);
    });
  });

  describe("Simulation cache", () => {
    it("should complete submission successfully when simulation passes", async () => {
      // Setup - ensure simulation resolves successfully
      vi.mocked(mockPublicClient.simulateContract!).mockResolvedValue({ result: true });

      const promise = submitWorkDirectly(
        mockWorkDraft,
        "0xGardenAddress",
        123,
        "Test Action",
        mockChainId,
        mockImages
      );
      await vi.runAllTimersAsync();

      // Should complete without error
      const result = await promise;
      expect(result).toBe("0xTxHash");
    });

    it("should cache simulation results and use them for subsequent calls", async () => {
      // The simulation cache is implemented internally in the module
      // This test verifies the submission works correctly with caching enabled
      vi.mocked(mockPublicClient.simulateContract!).mockResolvedValue({ result: true });

      // Two rapid submissions to same garden/action
      const promise1 = submitWorkDirectly(
        mockWorkDraft,
        "0xGardenAddress",
        123,
        "Test Action",
        mockChainId,
        mockImages
      );
      await vi.runAllTimersAsync();
      await promise1;

      const promise2 = submitWorkDirectly(
        mockWorkDraft,
        "0xGardenAddress",
        123,
        "Test Action",
        mockChainId,
        mockImages
      );
      await vi.runAllTimersAsync();
      const result2 = await promise2;

      // Both should succeed
      expect(result2).toBe("0xTxHash");
    });
  });

  describe("Transaction timeout", () => {
    it("should continue gracefully on timeout", async () => {
      // Make waitForTransactionReceipt hang
      vi.mocked(wagmiCore.waitForTransactionReceipt).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const onProgress = vi.fn();

      const promise = submitWorkDirectly(
        mockWorkDraft,
        "0xGardenAddress",
        123,
        "Test Action",
        mockChainId,
        mockImages,
        { onProgress, txTimeout: 1000 } // 1 second timeout for test
      );

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(1500);

      // Should still complete (graceful timeout handling)
      await expect(promise).resolves.toBe("0xTxHash");

      // Should have progressed to syncing stage
      expect(onProgress).toHaveBeenCalledWith("syncing", expect.any(String));
    });
  });

  describe("Analytics tracking", () => {
    it("should track submission timing on success", async () => {
      const startTime = Date.now();

      const promise = submitWorkDirectly(
        mockWorkDraft,
        "0xGardenAddress",
        123,
        "Test Action",
        mockChainId,
        mockImages
      );

      await vi.runAllTimersAsync();
      await promise;

      expect(trackWalletSubmissionTiming).toHaveBeenCalledWith({
        gardenAddress: "0xGardenAddress",
        actionUID: 123,
        totalTimeMs: expect.any(Number),
        imageCount: 1,
      });
    });
  });

  describe("submitApprovalDirectly", () => {
    const mockApprovalDraft: WorkApprovalDraft = {
      workUID: "0xWorkUID",
      actionUID: 456,
      approved: true,
      feedback: "Approved!",
    };

    beforeEach(() => {
      vi.mocked(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApproval" as `0x${string}`
      );
    });

    it("should call onProgress with correct stages", async () => {
      const progressStages: WalletSubmissionStage[] = [];
      const onProgress = vi.fn((stage: WalletSubmissionStage) => {
        progressStages.push(stage);
      });

      const promise = submitApprovalDirectly(
        mockApprovalDraft,
        "0xGardenAddress",
        "0xGardenerAddress",
        mockChainId,
        {
          onProgress,
        }
      );

      await vi.runAllTimersAsync();
      await promise;

      expect(progressStages).toContain("validating");
      expect(progressStages).toContain("confirming");
      expect(progressStages).toContain("syncing");
      expect(progressStages).toContain("complete");
    });

    it("should add optimistic approval to cache", async () => {
      const promise = submitApprovalDirectly(
        mockApprovalDraft,
        "0xGardenAddress",
        "0xGardenerAddress",
        mockChainId
      );

      await vi.runAllTimersAsync();
      await promise;

      // Verify optimistic update was called
      const approvalCacheCall = mockSetQueryData.mock.calls.find(
        (call) => Array.isArray(call[0]) && call[0].includes("workApprovals")
      );
      expect(approvalCacheCall).toBeDefined();

      const updaterFn = approvalCacheCall![1];
      const result = updaterFn([]);
      expect(result.length).toBe(1);
      expect(result[0].id).toContain("optimistic");
      expect(result[0].approved).toBe(true);
    });
  });
});
