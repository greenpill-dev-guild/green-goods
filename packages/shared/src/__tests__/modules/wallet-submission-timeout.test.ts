/**
 * Wallet Submission Timeout Tests
 *
 * Tests for BUG-013: Wallet reject flow should not hang in pending state.
 * Verifies that:
 * - Receipt wait has a timeout mechanism (60s default)
 * - Transaction hash is returned even if receipt times out
 * - Progress callback is fired at each stage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

// Mock wagmi/core
const mockWaitForTransactionReceipt = vi.fn();
const mockGetWalletClient = vi.fn();
const mockGetPublicClient = vi.fn();

vi.mock("@wagmi/core", () => ({
  waitForTransactionReceipt: (...args: unknown[]) => mockWaitForTransactionReceipt(...args),
  getWalletClient: (...args: unknown[]) => mockGetWalletClient(...args),
  getPublicClient: (...args: unknown[]) => mockGetPublicClient(...args),
}));

// Mock config
vi.mock("../../config/appkit", () => ({
  wagmiConfig: {},
}));

vi.mock("../../config/blockchain", () => ({
  getEASConfig: () => ({
    WORK: { uid: "0x123" },
    WORK_APPROVAL: { uid: "0x456" },
    EAS: { address: "0xEAS" },
    SCHEMA_REGISTRY: { address: "0xRegistry" },
  }),
}));

vi.mock("../../config/react-query", () => ({
  queryClient: {
    setQueryData: vi.fn(),
    getQueryData: vi.fn(() => []),
    invalidateQueries: vi.fn(),
  },
}));

// Mock other utils
vi.mock("../../hooks/query-keys", () => ({
  queryKeys: {
    works: {
      online: () => ["works", "online"],
      merged: () => ["works", "merged"],
      all: ["works"],
    },
    workApprovals: {
      all: ["workApprovals"],
    },
  },
}));

vi.mock("../../utils/blockchain/contracts", () => ({
  EASABI: [],
}));

vi.mock("../../utils/blockchain/polling", () => ({
  pollQueriesAfterTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
  debugError: vi.fn(),
  debugWarn: vi.fn(),
}));

vi.mock("../../utils/eas/encoders", () => ({
  encodeWorkApprovalData: () => "0xEncodedData",
  encodeWorkData: () => Promise.resolve("0xEncodedData"),
  simulateWorkData: () => "0xSimData",
}));

vi.mock("../../utils/eas/transaction-builder", () => ({
  buildApprovalAttestTx: () => ({
    to: "0xEAS" as `0x${string}`,
    data: "0xTxData" as `0x${string}`,
    value: 0n,
  }),
  buildWorkAttestTx: () => ({
    to: "0xEAS" as `0x${string}`,
    data: "0xTxData" as `0x${string}`,
    value: 0n,
  }),
}));

vi.mock("../../utils/errors/contract-errors", () => ({
  parseContractError: () => ({ isKnown: false, message: "Unknown error", recoverable: true }),
}));

vi.mock("../../utils/errors/user-messages", () => ({
  formatWalletError: (err: unknown) => (err as { message?: string })?.message || "Wallet error",
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

// Import after mocks are set up
import {
  submitApprovalDirectly,
  type WalletSubmissionStage,
} from "../../modules/work/wallet-submission";

// ============================================================================
// Test Data
// ============================================================================

const mockDraft: WorkApprovalDraft = {
  workUID: "0xWork123" as `0x${string}`,
  actionUID: 1,
  approved: true,
  feedback: "Great work!",
};

const mockGardenAddress = "0xGarden456";
const mockGardenerAddress = "0xGardener789";
const mockChainId = 84532;
const mockTxHash =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

const createMockWalletClient = () => ({
  account: { address: "0xUser123" as `0x${string}` },
  chain: { id: mockChainId },
  sendTransaction: vi.fn().mockResolvedValue(mockTxHash),
});

// ============================================================================
// Tests
// ============================================================================

describe("modules/work/wallet-submission timeout handling (BUG-013)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("submitApprovalDirectly", () => {
    it("returns transaction hash when receipt arrives quickly", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);
      mockWaitForTransactionReceipt.mockResolvedValue({ status: "success" });

      const resultPromise = submitApprovalDirectly(
        mockDraft,
        mockGardenAddress,
        mockGardenerAddress,
        mockChainId
      );

      // Fast-forward just a bit to allow promise to resolve
      await vi.advanceTimersByTimeAsync(100);

      const result = await resultPromise;

      expect(result).toBe(mockTxHash);
    });

    it("returns hash and continues gracefully when receipt times out", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      // Mock receipt that never resolves
      mockWaitForTransactionReceipt.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const onProgress = vi.fn();
      const resultPromise = submitApprovalDirectly(
        mockDraft,
        mockGardenAddress,
        mockGardenerAddress,
        mockChainId,
        {
          onProgress,
          txTimeout: 1000, // Short timeout for test
        }
      );

      // Fast-forward past the timeout
      await vi.advanceTimersByTimeAsync(1500);

      const result = await resultPromise;

      // Should return hash despite timeout
      expect(result).toBe(mockTxHash);
      // Should have progressed to syncing stage
      expect(onProgress).toHaveBeenCalledWith("syncing", expect.any(String));
    });

    it("fires progress callback at each stage", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);
      mockWaitForTransactionReceipt.mockResolvedValue({ status: "success" });

      const stages: WalletSubmissionStage[] = [];
      const onProgress = vi.fn((stage: WalletSubmissionStage) => {
        stages.push(stage);
      });

      const resultPromise = submitApprovalDirectly(
        mockDraft,
        mockGardenAddress,
        mockGardenerAddress,
        mockChainId,
        {
          onProgress,
        }
      );

      await vi.advanceTimersByTimeAsync(100);
      await resultPromise;

      expect(stages).toContain("validating");
      expect(stages).toContain("confirming");
      expect(stages).toContain("syncing");
      expect(stages).toContain("complete");
    });

    it("throws error if wallet client is not available", async () => {
      mockGetWalletClient.mockResolvedValue(null);

      await expect(
        submitApprovalDirectly(mockDraft, mockGardenAddress, mockGardenerAddress, mockChainId)
      ).rejects.toThrow("Wallet not connected");
    });

    it("throws error if transaction send fails", async () => {
      const mockWalletClient = createMockWalletClient();
      mockWalletClient.sendTransaction = vi.fn().mockRejectedValue(new Error("User rejected"));
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      await expect(
        submitApprovalDirectly(mockDraft, mockGardenAddress, mockGardenerAddress, mockChainId)
      ).rejects.toThrow("User rejected");
    });
  });

  describe("timeout configuration", () => {
    it("uses custom timeout when provided", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      // Mock receipt that never resolves
      mockWaitForTransactionReceipt.mockImplementation(() => new Promise(() => {}));

      const resultPromise = submitApprovalDirectly(
        mockDraft,
        mockGardenAddress,
        mockGardenerAddress,
        mockChainId,
        {
          txTimeout: 500, // Very short timeout
        }
      );

      // Should complete after custom timeout
      await vi.advanceTimersByTimeAsync(600);

      const result = await resultPromise;
      expect(result).toBe(mockTxHash);
    });

    it("uses default 60s timeout when not specified", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      // Track when receipt function is called
      let receiptResolved = false;
      mockWaitForTransactionReceipt.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              receiptResolved = true;
              resolve({ status: "success" });
            }, 70_000); // Resolves after 70s (past default timeout)
          })
      );

      const resultPromise = submitApprovalDirectly(
        mockDraft,
        mockGardenAddress,
        mockGardenerAddress,
        mockChainId
      );

      // Advance to just past 60s default timeout
      await vi.advanceTimersByTimeAsync(61_000);

      const result = await resultPromise;

      // Should return hash (timeout handled gracefully)
      expect(result).toBe(mockTxHash);
      // Receipt should not have resolved yet
      expect(receiptResolved).toBe(false);
    });
  });
});
