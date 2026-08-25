/**
 * EmbeddedSender Tests
 * @vitest-environment jsdom
 *
 * Tests the embedded wallet transaction sender that targets EIP-5792
 * sendCalls with paymaster capability. Since wagmi experimental APIs
 * are not available in the current version, it falls back to standard
 * writeContract.
 *
 * Uses dependency injection instead of vi.mock("@wagmi/core") to avoid
 * mock collisions with other test files when running with isolate: false.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeWagmiDeps,
  createMockContractCall,
  MOCK_TX_HASH,
} from "@green-goods/shared/testing";
import type { ContractCall } from "../types";
import { EmbeddedSender, type EmbeddedSenderDeps } from "../embedded-sender";

// ============================================
// Test fixtures
// ============================================

const VALID_RECIPIENT = "0x1111111111111111111111111111111111111111" as const;
const TEST_CALL = createMockContractCall();
const MOCK_ERC7677_URL = "https://paymaster.example.com/rpc";

// ============================================
// Tests
// ============================================

describe("EmbeddedSender", () => {
  let sender: EmbeddedSender;
  let mockDeps: EmbeddedSenderDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    const fakeWagmi = createFakeWagmiDeps();
    mockDeps = fakeWagmi;
    sender = new EmbeddedSender(fakeWagmi.config, MOCK_ERC7677_URL, mockDeps);
  });

  describe("properties", () => {
    it("reports supportsSponsorship as false", () => {
      expect(sender.supportsSponsorship).toBe(false);
    });

    it("reports supportsBatching as false", () => {
      expect(sender.supportsBatching).toBe(false);
    });

    it("reports authMode as embedded", () => {
      expect(sender.authMode).toBe("embedded");
    });
  });

  describe("sendContractCall", () => {
    it("sends transaction via writeContract and waits for receipt", async () => {
      const result = await sender.sendContractCall(TEST_CALL);

      expect(result.hash).toBe(MOCK_TX_HASH);
      expect(result.sponsored).toBe(false);
      expect(mockDeps.writeContract).toHaveBeenCalledOnce();
      expect(mockDeps.waitForTransactionReceipt).toHaveBeenCalledOnce();
    });

    it("passes correct parameters to writeContract", async () => {
      await sender.sendContractCall(TEST_CALL);

      expect(mockDeps.writeContract).toHaveBeenCalledWith(expect.anything(), {
        address: TEST_CALL.address,
        abi: TEST_CALL.abi,
        functionName: TEST_CALL.functionName,
        args: TEST_CALL.args,
        chainId: TEST_CALL.chainId,
      });
    });

    it("switches to the target chain before sending", async () => {
      await sender.sendContractCall(TEST_CALL);

      expect(mockDeps.ensureWalletChain).toHaveBeenCalledWith(TEST_CALL.chainId);
      expect(mockDeps.writeContract).toHaveBeenCalledOnce();
    });

    it("passes payable value when specified in call", async () => {
      await sender.sendContractCall({ ...TEST_CALL, value: 123n });

      expect(mockDeps.writeContract).toHaveBeenCalledWith(expect.anything(), {
        address: TEST_CALL.address,
        abi: TEST_CALL.abi,
        functionName: TEST_CALL.functionName,
        args: TEST_CALL.args,
        chainId: TEST_CALL.chainId,
        value: 123n,
      });
    });

    it("throws when transaction reverts", async () => {
      (mockDeps.waitForTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: "reverted",
      });

      await expect(sender.sendContractCall(TEST_CALL)).rejects.toThrow(
        "Transaction reverted on-chain"
      );
    });

    it("propagates errors from writeContract", async () => {
      (mockDeps.writeContract as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Embedded wallet rejected")
      );

      await expect(sender.sendContractCall(TEST_CALL)).rejects.toThrow("Embedded wallet rejected");
    });
  });

  describe("sendBatch", () => {
    it("sends multiple calls sequentially", async () => {
      const hash1 = `0x${"a".repeat(64)}` as `0x${string}`;
      const hash2 = `0x${"b".repeat(64)}` as `0x${string}`;
      (mockDeps.writeContract as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(hash1)
        .mockResolvedValueOnce(hash2);

      const calls: ContractCall[] = [TEST_CALL, { ...TEST_CALL, args: [VALID_RECIPIENT, 2000n] }];
      const result = await sender.sendBatch(calls);

      expect(result.hash).toBe(hash2);
      expect(result.sponsored).toBe(false);
      expect(mockDeps.writeContract).toHaveBeenCalledTimes(2);
    });

    it("throws on empty batch", async () => {
      await expect(sender.sendBatch([])).rejects.toThrow("Cannot send empty batch");
    });
  });
});
