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

    it("rejects an account change during the Celo switch before submitting", async () => {
      const expectedAccount = "0x1111111111111111111111111111111111111111" as const;
      let activeAccount: `0x${string}` = expectedAccount;
      mockDeps.getAccount = () => ({ address: activeAccount });
      vi.mocked(mockDeps.ensureWalletChain!).mockImplementationOnce(async () => {
        activeAccount = "0x2222222222222222222222222222222222222222";
      });
      await expect(
        sender.sendContractCall({ ...TEST_CALL, chainId: 42220, account: expectedAccount })
      ).rejects.toMatchObject({ code: "account_mismatch" });
      expect(mockDeps.writeContract).not.toHaveBeenCalled();
    });

    it("binds the quoted account to the wallet write parameters", async () => {
      const account = "0x1111111111111111111111111111111111111111" as const;
      mockDeps.getAccount = () => ({ address: account });
      await sender.sendContractCall({ ...TEST_CALL, chainId: 42220, account });
      expect(mockDeps.writeContract).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ account, chainId: 42220 })
      );
    });

    it.each([
      "cancelled",
      "replaced",
    ] as const)("rejects a %s receipt instead of reporting the original send confirmed", async (reason) => {
      vi.mocked(mockDeps.waitForTransactionReceipt).mockImplementationOnce(
        async (_config, params) => {
          params.onReplaced?.({ reason });
          return { status: "success", transactionHash: `0x${"b".repeat(64)}` };
        }
      );
      await expect(sender.sendContractCall(TEST_CALL)).rejects.toMatchObject({
        code: reason === "cancelled" ? "transaction_cancelled" : "transaction_replaced",
      });
    });

    it("accepts repricing and returns the included replacement hash", async () => {
      const transactionHash = `0x${"b".repeat(64)}` as const;
      vi.mocked(mockDeps.waitForTransactionReceipt).mockImplementationOnce(
        async (_config, params) => {
          params.onReplaced?.({ reason: "repriced" });
          return { status: "success", transactionHash };
        }
      );
      await expect(sender.sendContractCall(TEST_CALL)).resolves.toEqual({
        hash: transactionHash,
        sponsored: false,
      });
    });

    it("switches to Celo and confirms a user-paid send", async () => {
      const result = await sender.sendContractCall({ ...TEST_CALL, chainId: 42220 });
      expect(mockDeps.ensureWalletChain).toHaveBeenCalledWith(42220);
      expect(mockDeps.writeContract).toHaveBeenCalled();
      expect(mockDeps.waitForTransactionReceipt).toHaveBeenCalledWith(expect.anything(), {
        onReplaced: expect.any(Function),
        hash: MOCK_TX_HASH,
        chainId: 42220,
      });
      expect(result.sponsored).toBe(false);
    });

    it("does not submit when Celo switching is rejected", async () => {
      vi.mocked(mockDeps.ensureWalletChain!).mockRejectedValueOnce(new Error("Switch rejected"));
      await expect(sender.sendContractCall({ ...TEST_CALL, chainId: 42220 })).rejects.toThrow(
        "Switch rejected"
      );
      expect(mockDeps.writeContract).not.toHaveBeenCalled();
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
