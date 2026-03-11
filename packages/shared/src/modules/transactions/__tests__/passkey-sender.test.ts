/**
 * PasskeySender Tests
 * @vitest-environment jsdom
 *
 * Tests the passkey transaction sender that uses a SmartAccountClient
 * to send UserOperations via a bundler.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Abi } from "viem";
import { MOCK_ADDRESSES, MOCK_TX_HASH } from "../../../__tests__/test-utils/mock-factories";
import type { ContractCall } from "../types";

// ============================================
// Mocks
// ============================================

const mockSendTransaction = vi.fn();

function createMockSmartAccountClient() {
  return {
    account: { address: MOCK_ADDRESSES.smartAccount },
    chain: { id: 11155111, name: "Sepolia" },
    sendTransaction: mockSendTransaction,
  };
}

// ============================================
// Import after mocks
// ============================================

import { PasskeySender } from "../passkey-sender";

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

// ============================================
// Tests
// ============================================

describe("PasskeySender", () => {
  let sender: PasskeySender;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);
    const client = createMockSmartAccountClient();
    sender = new PasskeySender(client as any);
  });

  describe("properties", () => {
    it("reports supportsSponsorship as true", () => {
      expect(sender.supportsSponsorship).toBe(true);
    });

    it("reports supportsBatching as false", () => {
      expect(sender.supportsBatching).toBe(false);
    });

    it("reports authMode as passkey", () => {
      expect(sender.authMode).toBe("passkey");
    });
  });

  describe("sendContractCall", () => {
    it("sends transaction via smartAccountClient.sendTransaction", async () => {
      const result = await sender.sendContractCall(TEST_CALL);

      expect(result.hash).toBe(MOCK_TX_HASH);
      expect(result.sponsored).toBe(true);
      expect(mockSendTransaction).toHaveBeenCalledOnce();
    });

    it("encodes function data and passes correct parameters", async () => {
      await sender.sendContractCall(TEST_CALL);

      const sendTxArgs = mockSendTransaction.mock.calls[0][0];
      expect(sendTxArgs.to).toBe(TEST_CALL.address);
      expect(sendTxArgs.value).toBe(0n);
      // data should be hex-encoded calldata
      expect(sendTxArgs.data).toMatch(/^0x/);
    });

    it("passes value when specified in call", async () => {
      const callWithValue: ContractCall = {
        ...TEST_CALL,
        value: 1000000n,
      };
      await sender.sendContractCall(callWithValue);

      const sendTxArgs = mockSendTransaction.mock.calls[0][0];
      expect(sendTxArgs.value).toBe(1000000n);
    });

    it("propagates errors from sendTransaction", async () => {
      mockSendTransaction.mockRejectedValueOnce(new Error("UserOp failed"));

      await expect(sender.sendContractCall(TEST_CALL)).rejects.toThrow("UserOp failed");
    });
  });

  describe("sendBatch", () => {
    it("sends multiple calls sequentially and returns the last hash", async () => {
      const hash1 = `0x${"a".repeat(64)}` as `0x${string}`;
      const hash2 = `0x${"b".repeat(64)}` as `0x${string}`;
      mockSendTransaction.mockResolvedValueOnce(hash1).mockResolvedValueOnce(hash2);

      const calls: ContractCall[] = [TEST_CALL, { ...TEST_CALL, args: [VALID_RECIPIENT, 2000n] }];
      const result = await sender.sendBatch(calls);

      expect(result.hash).toBe(hash2);
      expect(result.sponsored).toBe(true);
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    });

    it("throws on empty batch", async () => {
      await expect(sender.sendBatch([])).rejects.toThrow("Cannot send empty batch");
    });
  });
});
