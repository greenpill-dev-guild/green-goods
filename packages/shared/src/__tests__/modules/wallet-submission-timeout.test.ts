/**
 * Wallet Submission Timeout Tests
 *
 * Tests for BUG-013: Wallet reject flow should not hang in pending state.
 * Verifies that:
 * - Receipt wait has a timeout mechanism
 * - Transaction hash is returned even if receipt times out
 * - Explorer URL is provided for user to check status
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

// Mock wagmi/core
const mockWaitForTransactionReceipt = vi.fn();
const mockGetWalletClient = vi.fn();
const mockGetPublicClient = vi.fn();

vi.mock("@wagmi/core", () => ({
  waitForTransactionReceipt: (...args: any[]) => mockWaitForTransactionReceipt(...args),
  getWalletClient: (...args: any[]) => mockGetWalletClient(...args),
  getPublicClient: (...args: any[]) => mockGetPublicClient(...args),
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
  parseContractError: () => ({ isKnown: false, message: "Unknown error" }),
}));

vi.mock("../../utils/errors/user-messages", () => ({
  formatWalletError: (err: any) => err?.message || "Wallet error",
}));

// Import after mocks are set up
import {
  submitApprovalDirectly,
  type WalletSubmissionResult,
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
    it("returns result with confirmed=true when receipt arrives quickly", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);
      mockWaitForTransactionReceipt.mockResolvedValue({ status: "success" });

      const resultPromise = submitApprovalDirectly(mockDraft, mockGardenAddress, mockChainId);

      // Fast-forward just a bit to allow promise to resolve
      await vi.advanceTimersByTimeAsync(100);

      const result = await resultPromise;

      expect(result.hash).toBe(mockTxHash);
      expect(result.confirmed).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(result.explorerUrl).toContain(mockTxHash);
    });

    it("returns result with timedOut=true when receipt takes too long", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      // Mock receipt that never resolves
      mockWaitForTransactionReceipt.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const resultPromise = submitApprovalDirectly(mockDraft, mockGardenAddress, mockChainId);

      // Fast-forward past the timeout (60 seconds)
      await vi.advanceTimersByTimeAsync(61_000);

      const result = await resultPromise;

      expect(result.hash).toBe(mockTxHash);
      expect(result.confirmed).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.explorerUrl).toContain(mockTxHash);
    });

    it("provides block explorer URL even on timeout", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      // Mock receipt that never resolves
      mockWaitForTransactionReceipt.mockImplementation(() => new Promise(() => {}));

      const resultPromise = submitApprovalDirectly(mockDraft, mockGardenAddress, mockChainId);

      await vi.advanceTimersByTimeAsync(61_000);

      const result = await resultPromise;

      // Should have an explorer URL for Base Sepolia
      expect(result.explorerUrl).toBe(`https://sepolia.basescan.org/tx/${mockTxHash}`);
    });

    it("does not hang indefinitely on receipt wait error", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      // Mock receipt that rejects (network error, etc.)
      mockWaitForTransactionReceipt.mockRejectedValue(new Error("Network error"));

      const resultPromise = submitApprovalDirectly(mockDraft, mockGardenAddress, mockChainId);

      await vi.advanceTimersByTimeAsync(100);

      const result = await resultPromise;

      // Should still return result - tx was sent successfully
      expect(result.hash).toBe(mockTxHash);
      expect(result.confirmed).toBe(false);
      expect(result.timedOut).toBe(false); // Not timed out, just errored
      expect(result.explorerUrl).toContain(mockTxHash);
    });

    it("throws error if wallet client is not available", async () => {
      mockGetWalletClient.mockResolvedValue(null);

      await expect(
        submitApprovalDirectly(mockDraft, mockGardenAddress, mockChainId)
      ).rejects.toThrow("Wallet not connected");
    });

    it("throws error if transaction send fails", async () => {
      const mockWalletClient = createMockWalletClient();
      mockWalletClient.sendTransaction = vi.fn().mockRejectedValue(new Error("User rejected"));
      mockGetWalletClient.mockResolvedValue(mockWalletClient);

      await expect(
        submitApprovalDirectly(mockDraft, mockGardenAddress, mockChainId)
      ).rejects.toThrow("User rejected");
    });
  });

  describe("WalletSubmissionResult type", () => {
    it("result has all required fields", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);
      mockWaitForTransactionReceipt.mockResolvedValue({ status: "success" });

      const resultPromise = submitApprovalDirectly(mockDraft, mockGardenAddress, mockChainId);

      await vi.advanceTimersByTimeAsync(100);

      const result = await resultPromise;

      // Type check - all fields should be present
      expect(result).toHaveProperty("hash");
      expect(result).toHaveProperty("confirmed");
      expect(result).toHaveProperty("timedOut");
      expect(result).toHaveProperty("explorerUrl");

      // Verify types
      expect(typeof result.hash).toBe("string");
      expect(typeof result.confirmed).toBe("boolean");
      expect(typeof result.timedOut).toBe("boolean");
      expect(typeof result.explorerUrl).toBe("string");
    });
  });

  describe("Explorer URL generation", () => {
    it("generates correct URL for Base Sepolia", async () => {
      const mockWalletClient = createMockWalletClient();
      mockGetWalletClient.mockResolvedValue(mockWalletClient);
      mockWaitForTransactionReceipt.mockResolvedValue({ status: "success" });

      const resultPromise = submitApprovalDirectly(mockDraft, mockGardenAddress, 84532);

      await vi.advanceTimersByTimeAsync(100);

      const result = await resultPromise;

      expect(result.explorerUrl).toBe(`https://sepolia.basescan.org/tx/${mockTxHash}`);
    });
  });
});
