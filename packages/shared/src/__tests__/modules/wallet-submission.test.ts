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
  wagmiConfig: {},
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
}));

vi.mock("../../utils/debug", () => ({
  DEBUG_ENABLED: false,
  debugLog: vi.fn(),
  debugError: vi.fn(),
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
import * as encoders from "../../utils/eas/encoders";

describe("wallet-submission", () => {
  const mockWalletClient: Partial<WalletClient> = {
    sendTransaction: vi.fn(),
    chain: { id: 84532 } as any,
    account: { address: "0xUserAddress" } as any,
  };

  const mockChainId = 84532;

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
      vi.mocked(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      vi.mocked(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      vi.mocked(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xTransactionHash" as `0x${string}`
      );
      vi.mocked(wagmiCore.waitForTransactionReceipt).mockResolvedValue({} as any);

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
        mockChainId
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
      vi.mocked(wagmiCore.getWalletClient).mockResolvedValue(null as any);

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

    it("should handle user rejection error", async () => {
      // Setup mocks
      vi.mocked(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      vi.mocked(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      vi.mocked(mockWalletClient.sendTransaction!).mockRejectedValue(
        new Error("User rejected the request")
      );

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
      ).rejects.toThrow("Transaction cancelled by user");
    });

    it("should handle insufficient funds error", async () => {
      // Setup mocks
      vi.mocked(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      vi.mocked(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      vi.mocked(mockWalletClient.sendTransaction!).mockRejectedValue(
        new Error("insufficient funds for gas")
      );

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
      ).rejects.toThrow("Insufficient funds for gas");
    });

    it("should handle network error", async () => {
      // Setup mocks
      vi.mocked(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      vi.mocked(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      vi.mocked(mockWalletClient.sendTransaction!).mockRejectedValue(
        new Error("network connection failed")
      );

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
      ).rejects.toThrow("Network error");
    });

    it("should handle nonce conflict error", async () => {
      // Setup mocks
      vi.mocked(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      vi.mocked(encoders.encodeWorkData).mockResolvedValue("0xEncodedWorkData" as `0x${string}`);
      vi.mocked(mockWalletClient.sendTransaction!).mockRejectedValue(new Error("nonce too low"));

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
      ).rejects.toThrow("Transaction conflict - please try again");
    });
  });

  describe("submitApprovalDirectly", () => {
    const mockApprovalDraft: WorkApprovalDraft = {
      workUID: "0xWorkUID",
      actionUID: 456,
      approved: true,
      feedback: "Great work!",
    };

    it("should successfully submit approval when wallet is connected", async () => {
      // Setup mocks
      vi.mocked(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      vi.mocked(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApprovalData" as `0x${string}`
      );
      vi.mocked(mockWalletClient.sendTransaction!).mockResolvedValue(
        "0xApprovalTxHash" as `0x${string}`
      );
      vi.mocked(wagmiCore.waitForTransactionReceipt).mockResolvedValue({} as any);

      // Execute
      const result = await submitApprovalDirectly(
        mockApprovalDraft,
        "0xGardenAddress",
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
      vi.mocked(wagmiCore.getWalletClient).mockResolvedValue(null as any);

      // Execute & Verify
      await expect(
        submitApprovalDirectly(mockApprovalDraft, "0xGardenAddress", mockChainId)
      ).rejects.toThrow("Wallet not connected");
    });

    it("should handle user rejection error for approval", async () => {
      // Setup mocks
      vi.mocked(wagmiCore.getWalletClient).mockResolvedValue(mockWalletClient as WalletClient);
      vi.mocked(encoders.encodeWorkApprovalData).mockReturnValue(
        "0xEncodedApprovalData" as `0x${string}`
      );
      vi.mocked(mockWalletClient.sendTransaction!).mockRejectedValue(
        new Error("User rejected the request")
      );

      // Execute & Verify
      await expect(
        submitApprovalDirectly(mockApprovalDraft, "0xGardenAddress", mockChainId)
      ).rejects.toThrow("Transaction cancelled by user");
    });
  });
});
