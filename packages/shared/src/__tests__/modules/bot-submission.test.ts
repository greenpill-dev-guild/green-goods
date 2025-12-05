/**
 * Bot Submission Module Tests
 *
 * Tests for Telegram bot work and approval submission functions.
 * These functions use WalletClient directly (Node.js compatible).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("../../config/blockchain", () => ({
  getEASConfig: vi.fn(() => ({
    EAS_CONTRACT: "0xEASContract",
    WORK: { uid: "0x" + "1".repeat(64) },
    WORK_APPROVAL: { uid: "0x" + "2".repeat(64) },
  })),
}));

vi.mock("../../utils/eas/encoders", () => ({
  encodeWorkData: vi.fn(async () => "0xEncodedWorkData"),
  encodeWorkApprovalData: vi.fn(() => "0xEncodedApprovalData"),
}));

vi.mock("../../utils/eas/transaction-builder", () => ({
  buildWorkAttestTx: vi.fn(() => ({
    to: "0xEASContract" as `0x${string}`,
    data: "0xWorkTxData" as `0x${string}`,
    value: BigInt(0),
  })),
  buildApprovalAttestTx: vi.fn(() => ({
    to: "0xEASContract" as `0x${string}`,
    data: "0xApprovalTxData" as `0x${string}`,
    value: BigInt(0),
  })),
}));

import { submitWorkBot, submitApprovalBot } from "../../modules/work/bot-submission";
import { encodeWorkData, encodeWorkApprovalData } from "../../utils/eas/encoders";
import { buildWorkAttestTx, buildApprovalAttestTx } from "../../utils/eas/transaction-builder";
import { getEASConfig } from "../../config/blockchain";

describe("modules/work/bot-submission", () => {
  const mockTxHash = ("0x" + "a".repeat(64)) as `0x${string}`;

  const mockWalletClient = {
    chain: { id: 84532, name: "Base Sepolia" },
    account: { address: "0xBotAddress" as `0x${string}` },
    sendTransaction: vi.fn().mockResolvedValue(mockTxHash),
  } as any;

  const mockPublicClient = {
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitWorkBot", () => {
    const mockWorkDraft = {
      feedback: "Bot submitted work",
      plantSelection: ["Rose", "Tulip"],
      plantCount: 3,
      media: [],
    } as any;

    it("encodes work data and sends transaction", async () => {
      const result = await submitWorkBot(
        mockWalletClient,
        mockPublicClient,
        mockWorkDraft,
        "0xGardenAddress",
        1,
        "Planting Trees",
        84532,
        []
      );

      expect(result).toBe(mockTxHash);
      expect(encodeWorkData).toHaveBeenCalledWith(
        expect.objectContaining({
          feedback: "Bot submitted work",
          actionUID: 1,
        }),
        84532
      );
      expect(buildWorkAttestTx).toHaveBeenCalled();
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "0xEASContract",
          chain: mockWalletClient.chain,
          account: mockWalletClient.account,
        })
      );
    });

    it("includes action title in encoded data", async () => {
      await submitWorkBot(
        mockWalletClient,
        mockPublicClient,
        mockWorkDraft,
        "0xGardenAddress",
        42,
        "Community Cleanup",
        84532,
        []
      );

      expect(encodeWorkData).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Community Cleanup"),
          actionUID: 42,
        }),
        84532
      );
    });

    it("passes garden address to transaction builder", async () => {
      const gardenAddress = "0xTestGarden123456789012345678901234567890";

      await submitWorkBot(
        mockWalletClient,
        mockPublicClient,
        mockWorkDraft,
        gardenAddress,
        1,
        "Test Action",
        84532,
        []
      );

      expect(buildWorkAttestTx).toHaveBeenCalledWith(
        expect.anything(),
        gardenAddress,
        expect.anything()
      );
    });

    it("handles images parameter", async () => {
      const mockImages = [
        new File(["content1"], "image1.jpg", { type: "image/jpeg" }),
        new File(["content2"], "image2.jpg", { type: "image/jpeg" }),
      ];

      await submitWorkBot(
        mockWalletClient,
        mockPublicClient,
        mockWorkDraft,
        "0xGarden",
        1,
        "Action",
        84532,
        mockImages
      );

      expect(encodeWorkData).toHaveBeenCalledWith(
        expect.objectContaining({
          media: mockImages,
        }),
        84532
      );
    });

    it("uses correct chain ID for config lookup", async () => {
      await submitWorkBot(
        mockWalletClient,
        mockPublicClient,
        mockWorkDraft,
        "0xGarden",
        1,
        "Action",
        42161, // Arbitrum
        []
      );

      expect(getEASConfig).toHaveBeenCalledWith(42161);
      expect(encodeWorkData).toHaveBeenCalledWith(expect.anything(), 42161);
    });

    it("propagates transaction errors", async () => {
      const error = new Error("Transaction failed");
      mockWalletClient.sendTransaction.mockRejectedValueOnce(error);

      await expect(
        submitWorkBot(
          mockWalletClient,
          mockPublicClient,
          mockWorkDraft,
          "0xGarden",
          1,
          "Action",
          84532,
          []
        )
      ).rejects.toThrow("Transaction failed");
    });
  });

  describe("submitApprovalBot", () => {
    const mockApprovalDraft = {
      workUID: "0xWorkUID123",
      actionUID: 1,
      approved: true,
      feedback: "Good work!",
    } as any;

    it("encodes approval data and sends transaction", async () => {
      const result = await submitApprovalBot(
        mockWalletClient,
        mockApprovalDraft,
        "0xGardenerAddress",
        84532
      );

      expect(result).toBe(mockTxHash);
      expect(encodeWorkApprovalData).toHaveBeenCalledWith(mockApprovalDraft, 84532);
      expect(buildApprovalAttestTx).toHaveBeenCalled();
      expect(mockWalletClient.sendTransaction).toHaveBeenCalled();
    });

    it("handles approval with feedback", async () => {
      const draftWithFeedback = {
        ...mockApprovalDraft,
        approved: true,
        feedback: "Excellent planting technique!",
      };

      await submitApprovalBot(mockWalletClient, draftWithFeedback, "0xGardener", 84532);

      expect(encodeWorkApprovalData).toHaveBeenCalledWith(
        expect.objectContaining({
          approved: true,
          feedback: "Excellent planting technique!",
        }),
        84532
      );
    });

    it("handles rejection with feedback", async () => {
      const rejectionDraft = {
        workUID: "0xWork",
        actionUID: 1,
        approved: false,
        feedback: "Plants were not watered properly",
      };

      await submitApprovalBot(mockWalletClient, rejectionDraft, "0xGardener", 84532);

      expect(encodeWorkApprovalData).toHaveBeenCalledWith(
        expect.objectContaining({
          approved: false,
          feedback: "Plants were not watered properly",
        }),
        84532
      );
    });

    it("passes gardener address to transaction builder", async () => {
      const gardenerAddress = "0xGardener123456789012345678901234567890";

      await submitApprovalBot(mockWalletClient, mockApprovalDraft, gardenerAddress, 84532);

      expect(buildApprovalAttestTx).toHaveBeenCalledWith(
        expect.anything(),
        gardenerAddress,
        expect.anything()
      );
    });

    it("uses correct chain for transaction", async () => {
      await submitApprovalBot(mockWalletClient, mockApprovalDraft, "0xGardener", 84532);

      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          chain: mockWalletClient.chain,
          account: mockWalletClient.account,
        })
      );
    });

    it("propagates transaction errors", async () => {
      const error = new Error("Approval transaction failed");
      mockWalletClient.sendTransaction.mockRejectedValueOnce(error);

      await expect(
        submitApprovalBot(mockWalletClient, mockApprovalDraft, "0xGardener", 84532)
      ).rejects.toThrow("Approval transaction failed");
    });

    it("handles empty feedback", async () => {
      const draftNoFeedback = {
        workUID: "0xWork",
        actionUID: 1,
        approved: true,
        feedback: "",
      };

      await submitApprovalBot(mockWalletClient, draftNoFeedback, "0xGardener", 84532);

      expect(encodeWorkApprovalData).toHaveBeenCalledWith(
        expect.objectContaining({
          feedback: "",
        }),
        84532
      );
    });
  });
});
