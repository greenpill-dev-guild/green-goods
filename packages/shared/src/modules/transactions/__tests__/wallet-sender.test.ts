/**
 * WalletSender Tests
 * @vitest-environment jsdom
 *
 * Tests the external wallet transaction sender that uses wagmi's
 * writeContractAsync, with Safe wallet non-canonical hash handling.
 *
 * Uses dependency injection instead of vi.mock("@wagmi/core") to avoid
 * mock collisions with other test files when running with isolate: false.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Abi } from "viem";
import { MOCK_TX_HASH } from "../../../__tests__/test-utils/mock-factories";
import type { ContractCall } from "../types";
import { WalletSender, type WalletSenderDeps } from "../wallet-sender";

// ============================================
// Test fixtures
// ============================================

const TEST_ABI: Abi = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
];

const VALID_RECIPIENT = "0x1111111111111111111111111111111111111111" as const;

const TEST_CALL: ContractCall = {
  address: "0x3333333333333333333333333333333333333333",
  abi: TEST_ABI,
  functionName: "transfer",
  args: [VALID_RECIPIENT, 1000n],
};

const MOCK_WAGMI_CONFIG = {} as any;

// ============================================
// Tests
// ============================================

describe("WalletSender", () => {
  let sender: WalletSender;
  let mockWriteContractAsync: ReturnType<typeof vi.fn>;
  let mockDeps: WalletSenderDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteContractAsync = vi.fn().mockResolvedValue(MOCK_TX_HASH);
    mockDeps = {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
    };
    sender = new WalletSender(MOCK_WAGMI_CONFIG, mockWriteContractAsync, undefined, mockDeps);
  });

  describe("properties", () => {
    it("reports supportsSponsorship as false (no EIP-5792 available)", () => {
      expect(sender.supportsSponsorship).toBe(false);
    });

    it("reports supportsBatching as false", () => {
      expect(sender.supportsBatching).toBe(false);
    });

    it("reports authMode as wallet", () => {
      expect(sender.authMode).toBe("wallet");
    });
  });

  describe("sendContractCall", () => {
    it("sends transaction via writeContractAsync", async () => {
      const result = await sender.sendContractCall(TEST_CALL);

      expect(result.hash).toBe(MOCK_TX_HASH);
      expect(result.sponsored).toBe(false);
      expect(mockWriteContractAsync).toHaveBeenCalledOnce();
    });

    it("passes correct parameters to writeContractAsync", async () => {
      await sender.sendContractCall(TEST_CALL);

      expect(mockWriteContractAsync).toHaveBeenCalledWith({
        address: TEST_CALL.address,
        abi: TEST_CALL.abi,
        functionName: TEST_CALL.functionName,
        args: TEST_CALL.args,
      });
    });

    it("waits for transaction receipt when hash is canonical", async () => {
      const result = await sender.sendContractCall(TEST_CALL);

      expect(result.hash).toBe(MOCK_TX_HASH);
      expect(mockDeps.waitForTransactionReceipt).toHaveBeenCalledOnce();
      expect(mockDeps.waitForTransactionReceipt).toHaveBeenCalledWith(MOCK_WAGMI_CONFIG, {
        hash: MOCK_TX_HASH,
      });
    });

    it("throws when transaction reverts on-chain", async () => {
      (mockDeps.waitForTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: "reverted",
      });

      await expect(sender.sendContractCall(TEST_CALL)).rejects.toThrow(
        "Transaction reverted on-chain"
      );
    });

    it("skips receipt wait for non-canonical hash (Safe-style wallet)", async () => {
      const safeStyleHash = `0x${"a".repeat(130)}` as `0x${string}`;
      mockWriteContractAsync.mockResolvedValueOnce(safeStyleHash);

      const result = await sender.sendContractCall(TEST_CALL);

      expect(result.hash).toBe(safeStyleHash);
      expect(result.sponsored).toBe(false);
      expect(mockDeps.waitForTransactionReceipt).not.toHaveBeenCalled();
    });

    it("propagates errors from writeContractAsync", async () => {
      mockWriteContractAsync.mockRejectedValueOnce(new Error("User rejected the request"));

      await expect(sender.sendContractCall(TEST_CALL)).rejects.toThrow("User rejected the request");
    });
  });

  describe("sendBatch (unsupported)", () => {
    it("does not expose sendBatch", () => {
      expect(sender.sendBatch).toBeUndefined();
    });
  });
});
