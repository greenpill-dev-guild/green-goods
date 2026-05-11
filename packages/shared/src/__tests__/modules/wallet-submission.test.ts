/**
 * Tests for wallet submission module
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Must mock before imports
vi.mock("@wagmi/core", () => ({
  getWalletClient: vi.fn(),
  getPublicClient: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

vi.mock("../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

vi.mock("../../config/blockchain", () => ({
  getEASConfig: () => ({
    EAS_CONTRACT: "0xEASAddress",
    WORK: { uid: "0x" + "1".repeat(64) },
    WORK_APPROVAL: { uid: "0x" + "2".repeat(64) },
  }),
}));

vi.mock("../../utils/eas/encoders", () => ({
  encodeWorkData: vi.fn(),
  encodeWorkApprovalData: vi.fn(),
  simulateWorkData: vi.fn(),
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
  TX_RECEIPT_TIMEOUT_MS: 120_000,
}));

vi.mock("../../modules/work/simulate", () => ({
  simulateWorkSubmission: vi.fn(),
  simulateApprovalSubmission: vi.fn(),
}));

vi.mock("../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock("../../config/query-keys", () => ({
  queryKeys: {
    works: {
      all: ["greengoods", "works"],
      mine: (userAddress?: string) => ["greengoods", "works", "mine", userAddress],
      mineByUser: (userAddress: string) => ["greengoods", "works", "mine", userAddress],
      online: (gardenId: string, chainId: number) => [
        "greengoods",
        "works",
        "online",
        gardenId,
        chainId,
      ],
      offline: (gardenId: string) => ["greengoods", "works", "offline", gardenId],
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
      byAttester: (address?: string, chainId?: number) => [
        "greengoods",
        "workApprovals",
        "byAttester",
        address,
        chainId,
      ],
      offline: (address?: string) => ["greengoods", "workApprovals", "offline", address],
    },
  },
}));

import * as wagmiCore from "@wagmi/core";
import type { WalletClient } from "viem";

import { submitApprovalDirectly, submitWorkDirectly } from "../../modules/work/wallet-submission";
import { WorkSubmissionError } from "../../modules/work/wallet-submission/types";
import * as encoders from "../../utils/eas/encoders";
import { mock } from "../test-utils";

describe("wallet-submission", () => {
  const mockWalletClient: Partial<WalletClient> = {
    sendTransaction: vi.fn(),
    chain: { id: 11155111 } as any,
    account: { address: "0xUserAddress" } as any,
  };

  const mockChainId = 11155111;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("submitWorkDirectly", () => {
    const mockWorkDraft: WorkDraft = {
      actionUID: 123,
      title: "Test Work",
      feedback: "Test feedback",
      plantSelection: ["plant1", "plant2"],
      plantCount: 10,
      media: [],
    };

    const mockImages = [
      new File(["image1"], "image1.jpg", { type: "image/jpeg" }),
      new File(["image2"], "image2.jpg", { type: "image/jpeg" }),
    ];

    it("should successfully submit work when wallet is connected", async () => {
      // Setup mocks
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      mock(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xTransactionHash" as `0x${string}`
      );
      mock(wagmiCore.waitForTransactionReceipt).mockResolvedValue({} as any);

      // Execute
      const result = await submitWorkDirectly(
        mockWorkDraft,
        "0xGardenAddress",
        123,
        "Test Action",
        mockChainId,
        mockImages
      );

      // Verify
      expect(result).toBe("0xTransactionHash");
      expect(wagmiCore.getWalletClient).toHaveBeenCalledWith({}, { chainId: mockChainId });
      expect(encoders.encodeWorkData).toHaveBeenCalledWith(
        expect.objectContaining({
          feedback: "Test feedback",
          actionUID: 123,
          media: mockImages,
        }),
        mockChainId,
        expect.objectContaining({
          authMode: "wallet",
          gardenAddress: "0xGardenAddress",
        })
      );
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "0xEASAddress",
          value: 0n,
        })
      );
      expect(wagmiCore.waitForTransactionReceipt).toHaveBeenCalledWith(
        {},
        { hash: "0xTransactionHash", chainId: mockChainId }
      );
    });

    it("should throw error when wallet is not connected", async () => {
      // Setup: no wallet client
      mock(wagmiCore.getWalletClient).mockResolvedValue(null as any);

      // Execute & Verify
      await expect(
        submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        )
      ).rejects.toThrow("Wallet not connected");
    });

    // The wallet-submission boundary module preserves the raw error message and
    // attaches the original via `cause`. Classification into user-friendly copy
    // now happens downstream in useWorkMutation.onError via parseContractError —
    // this avoids the dead-work pattern where pre-formatted messages were
    // discarded by the unwrap+reclassify in the mutation.
    it("should preserve user rejection error message and cause", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      const original = new Error("User rejected the request");
      mock(mockWalletClient.sendTransaction!).mockRejectedValue(original);

      try {
        await submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(WorkSubmissionError);
        expect((error as WorkSubmissionError).phase).toBe("transaction");
        expect((error as Error).message).toBe("User rejected the request");
        expect((error as Error).cause).toBe(original);
      }
    });

    it("should preserve insufficient funds error message and cause", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      const original = new Error("insufficient funds for gas");
      mock(mockWalletClient.sendTransaction!).mockRejectedValue(original);

      try {
        await submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe("insufficient funds for gas");
        expect((error as Error).cause).toBe(original);
      }
    });

    it("should preserve network error message during transaction phase", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      const original = new Error("network connection failed");
      mock(mockWalletClient.sendTransaction!).mockRejectedValue(original);

      try {
        await submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(WorkSubmissionError);
        expect((error as WorkSubmissionError).phase).toBe("transaction");
        expect((error as Error).message).toBe("network connection failed");
        expect((error as Error).cause).toBe(original);
      }
    });

    it("should wrap IPFS upload failure with phase 'upload'", async () => {
      // Setup: wallet connected, but IPFS upload fails
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      const ipfsError = new Error("Failed to verify Pinata gateway: 504 Gateway Timeout");
      mock(encoders.encodeWorkData).mockRejectedValue(ipfsError);

      // Execute & Verify
      try {
        await submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        );
        expect.fail("Should have thrown");
      } catch (error) {
        // The error should be a WorkSubmissionError with phase "upload"
        expect(error).toBeInstanceOf(WorkSubmissionError);
        expect((error as WorkSubmissionError).phase).toBe("upload");
        // The original IPFS error should be preserved as the cause
        expect((error as Error).cause).toBe(ipfsError);
      }
    });

    it("should preserve nonce conflict error message and cause", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      const original = new Error("nonce too low");
      mock(mockWalletClient.sendTransaction!).mockRejectedValue(original);

      try {
        await submitWorkDirectly(
          mockWorkDraft,
          "0xGardenAddress",
          123,
          "Test Action",
          mockChainId,
          mockImages
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe("nonce too low");
        expect((error as Error).cause).toBe(original);
      }
    });
  });

  describe("submitApprovalDirectly", () => {
    const mockApprovalDraft: WorkApprovalDraft = {
      workUID: "0xWorkUID",
      actionUID: 456,
      approved: true,
      feedback: "Great work!",
      confidence: 2,
      verificationMethod: 1,
    };

    it("should successfully submit approval when wallet is connected", async () => {
      // Setup mocks
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApprovalData" as `0x${string}`
      );
      mock(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xApprovalTxHash" as `0x${string}`
      );
      mock(wagmiCore.waitForTransactionReceipt).mockResolvedValue({} as any);

      // Execute
      const result = await submitApprovalDirectly(
        mockApprovalDraft,
        "0xGardenAddress",
        "0xGardenerAddress",
        mockChainId
      );

      // Verify
      expect(result).toBe("0xApprovalTxHash");
      expect(wagmiCore.getWalletClient).toHaveBeenCalledWith({}, { chainId: mockChainId });
      expect(encoders.encodeWorkApprovalData).toHaveBeenCalledWith(mockApprovalDraft, mockChainId);
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "0xEASAddress",
          value: 0n,
        })
      );
      expect(wagmiCore.waitForTransactionReceipt).toHaveBeenCalledWith(
        {},
        { hash: "0xApprovalTxHash", chainId: mockChainId }
      );
    });

    it("should throw error when wallet is not connected", async () => {
      // Setup: no wallet client
      mock(wagmiCore.getWalletClient).mockResolvedValue(null as any);

      // Execute & Verify
      await expect(
        submitApprovalDirectly(
          mockApprovalDraft,
          "0xGardenAddress",
          "0xGardenerAddress",
          mockChainId
        )
      ).rejects.toThrow("Wallet not connected");
    });

    it("should preserve user rejection error message and cause for approval", async () => {
      mock(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      mock(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApprovalData" as `0x${string}`
      );
      const original = new Error("User rejected the request");
      mock(mockWalletClient.sendTransaction!).mockRejectedValue(original);

      try {
        await submitApprovalDirectly(
          mockApprovalDraft,
          "0xGardenAddress",
          "0xGardenerAddress",
          mockChainId
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe("User rejected the request");
        expect((error as Error).cause).toBe(original);
      }
    });
  });
});
