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
import {
  createFakeWagmiDeps,
  createMockContractCall,
  MOCK_TX_HASH,
} from "@green-goods/shared/testing";
import { TransactionRevertedError, type ContractCall } from "../types";
import { WalletSender, type WalletSenderDeps } from "../wallet-sender";

// ============================================
// Test fixtures
// ============================================

const VALID_RECIPIENT = "0x1111111111111111111111111111111111111111" as const;
const TEST_CALL = createMockContractCall();

// ============================================
// Tests
// ============================================

describe("WalletSender", () => {
  let sender: WalletSender;
  let mockWriteContractAsync: ReturnType<
    typeof vi.fn<ConstructorParameters<typeof WalletSender>[1]>
  >;
  let mockDeps: WalletSenderDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    const fakeWagmi = createFakeWagmiDeps();
    mockWriteContractAsync = fakeWagmi.writeContractAsync;
    mockDeps = fakeWagmi;
    sender = new WalletSender(fakeWagmi.config, mockWriteContractAsync, undefined, mockDeps);
  });

  it("awaits broadcast persistence before requesting a receipt", async () => {
    const broadcast = vi.fn(async () => {
      expect(mockDeps.waitForTransactionReceipt).not.toHaveBeenCalled();
    });
    await sender.sendContractCall(TEST_CALL, { onBroadcast: broadcast });
    expect(broadcast).toHaveBeenCalledWith(MOCK_TX_HASH);
    expect(mockDeps.waitForTransactionReceipt).toHaveBeenCalledOnce();
  });
  it("does not hide a failed broadcast checkpoint", async () => {
    await expect(
      sender.sendContractCall(TEST_CALL, {
        onBroadcast: async () => {
          throw new Error("quota");
        },
      })
    ).rejects.toThrow("quota");
    expect(mockDeps.waitForTransactionReceipt).not.toHaveBeenCalled();
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
      expect(mockDeps.assertWriteSafety).toHaveBeenCalledOnce();
    });

    it("passes correct parameters to writeContractAsync", async () => {
      await sender.sendContractCall(TEST_CALL);

      expect(mockWriteContractAsync).toHaveBeenCalledWith({
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
      expect(mockWriteContractAsync).not.toHaveBeenCalled();
    });

    it("binds the quoted account to the wallet write parameters", async () => {
      const account = "0x1111111111111111111111111111111111111111" as const;
      mockDeps.getAccount = () => ({ address: account });
      await sender.sendContractCall({ ...TEST_CALL, chainId: 42220, account });
      expect(mockWriteContractAsync).toHaveBeenCalledWith(
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
      const onBroadcastReference = vi.fn();
      vi.mocked(mockDeps.waitForTransactionReceipt).mockImplementationOnce(
        async (_config, params) => {
          params.onReplaced?.({ reason: "repriced" });
          return { status: "success", transactionHash };
        }
      );
      await expect(sender.sendContractCall(TEST_CALL, { onBroadcastReference })).resolves.toEqual({
        hash: transactionHash,
        sponsored: false,
      });
      expect(onBroadcastReference).toHaveBeenLastCalledWith({
        kind: "transaction",
        hash: transactionHash,
      });
    });

    it("switches to Celo and confirms a user-paid send", async () => {
      const result = await sender.sendContractCall({ ...TEST_CALL, chainId: 42220 });
      expect(mockDeps.ensureWalletChain).toHaveBeenCalledWith(42220);
      expect(mockWriteContractAsync).toHaveBeenCalled();
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
      expect(mockWriteContractAsync).not.toHaveBeenCalled();
    });

    it("switches to the target chain before sending", async () => {
      await sender.sendContractCall(TEST_CALL);

      expect(mockDeps.ensureWalletChain).toHaveBeenCalledWith(TEST_CALL.chainId);
      expect(mockWriteContractAsync).toHaveBeenCalledOnce();
    });

    it("passes payable value when specified in call", async () => {
      await sender.sendContractCall({ ...TEST_CALL, value: 123n });

      expect(mockWriteContractAsync).toHaveBeenCalledWith({
        address: TEST_CALL.address,
        abi: TEST_CALL.abi,
        functionName: TEST_CALL.functionName,
        args: TEST_CALL.args,
        chainId: TEST_CALL.chainId,
        value: 123n,
      });
    });

    it("waits for transaction receipt when hash is canonical", async () => {
      const result = await sender.sendContractCall(TEST_CALL);

      expect(result.hash).toBe(MOCK_TX_HASH);
      expect(mockDeps.waitForTransactionReceipt).toHaveBeenCalledOnce();
      expect(mockDeps.waitForTransactionReceipt).toHaveBeenCalledWith(expect.anything(), {
        onReplaced: expect.any(Function),
        hash: MOCK_TX_HASH,
        chainId: TEST_CALL.chainId,
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
      expect(result.confirmation).toBe("pending");
      expect(result.sponsored).toBe(false);
      expect(mockDeps.waitForTransactionReceipt).not.toHaveBeenCalled();
    });

    it("propagates errors from writeContractAsync", async () => {
      mockWriteContractAsync.mockRejectedValueOnce(new Error("User rejected the request"));

      await expect(sender.sendContractCall(TEST_CALL)).rejects.toThrow("User rejected the request");
    });

    it("blocks writes when the local fork safety guard rejects", async () => {
      (mockDeps.assertWriteSafety as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("wrong wallet RPC")
      );

      await expect(sender.sendContractCall(TEST_CALL)).rejects.toThrow("wrong wallet RPC");
      expect(mockWriteContractAsync).not.toHaveBeenCalled();
    });
  });

  describe("sendBatch (unsupported)", () => {
    it("does not expose sendBatch", () => {
      expect("sendBatch" in sender).toBe(false);
    });
  });

  describe("atomic batches", () => {
    const BATCH_HASH = `0x${"b".repeat(64)}` as const;
    const SECOND_CALL = createMockContractCall({ functionName: "approve" });
    let batchDeps: WalletSenderDeps;
    let batchWrite: ReturnType<typeof createFakeWagmiDeps>["writeContractAsync"];
    let batchConfig: ReturnType<typeof createFakeWagmiDeps>["config"];
    let trace: string[];

    beforeEach(() => {
      trace = [];
      const fake = createFakeWagmiDeps();
      batchWrite = fake.writeContractAsync;
      batchConfig = fake.config;
      batchDeps = {
        ...fake,
        ensureWalletChain: vi.fn(async () => {
          trace.push("chain");
        }),
        assertWriteSafety: vi.fn(async () => {
          trace.push("safety");
        }),
        getCapabilities: vi.fn(async () => ({ atomic: { status: "supported" } })),
        sendCalls: vi.fn(async () => {
          trace.push("sendCalls");
          return { id: "bundle-1" };
        }),
        waitForCallsStatus: vi.fn(async () => {
          trace.push("status");
          return {
            status: "success",
            receipts: [{ status: "success", transactionHash: BATCH_HASH }],
          };
        }),
      };
      sender = new WalletSender(batchConfig, batchWrite, undefined, batchDeps);
    });

    it("offers a batch only to a wallet that already runs calls as one transaction", async () => {
      await expect(sender.canSendAtomicBatch(42161)).resolves.toBe(true);
      // "ready" would first ask to upgrade the account; setup never starts that.
      vi.mocked(batchDeps.getCapabilities!).mockResolvedValueOnce({ atomic: { status: "ready" } });
      await expect(sender.canSendAtomicBatch(42161)).resolves.toBe(false);
      vi.mocked(batchDeps.getCapabilities!).mockResolvedValueOnce({
        atomic: { status: "unsupported" },
      });
      await expect(sender.canSendAtomicBatch(42161)).resolves.toBe(false);
      vi.mocked(batchDeps.getCapabilities!).mockRejectedValueOnce(
        new Error("Method not supported")
      );
      await expect(sender.canSendAtomicBatch(42161)).resolves.toBe(false);
    });

    it("treats a wallet that never answers as one that cannot batch", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(batchDeps.getCapabilities!).mockReturnValueOnce(new Promise(() => {}));
        const answer = sender.canSendAtomicBatch(42161);
        await vi.advanceTimersByTimeAsync(4_000);
        await expect(answer).resolves.toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("guards the chain first, then sends every call in one atomic request", async () => {
      const accepted = vi.fn(async () => {
        trace.push("accepted");
      });
      const result = await sender.sendAtomicBatch([TEST_CALL, SECOND_CALL], {
        onAccepted: accepted,
      });

      expect(result).toEqual({ hash: BATCH_HASH, sponsored: false });
      expect(trace).toEqual(["chain", "safety", "sendCalls", "accepted", "status"]);
      expect(batchDeps.sendCalls).toHaveBeenCalledWith(batchConfig, {
        chainId: TEST_CALL.chainId,
        forceAtomic: true,
        calls: [
          {
            to: TEST_CALL.address,
            abi: TEST_CALL.abi,
            functionName: TEST_CALL.functionName,
            args: TEST_CALL.args,
          },
          {
            to: SECOND_CALL.address,
            abi: SECOND_CALL.abi,
            functionName: "approve",
            args: SECOND_CALL.args,
          },
        ],
      });
      expect(batchWrite).not.toHaveBeenCalled();
    });

    it("says a reverted batch wrote nothing, and an unanswered one is unknown", async () => {
      vi.mocked(batchDeps.waitForCallsStatus!).mockResolvedValueOnce({
        status: "failure",
        receipts: [{ status: "reverted", transactionHash: BATCH_HASH }],
      });
      await expect(sender.sendAtomicBatch([TEST_CALL, SECOND_CALL])).rejects.toBeInstanceOf(
        TransactionRevertedError
      );

      vi.mocked(batchDeps.waitForCallsStatus!).mockResolvedValueOnce({ status: "pending" });
      await expect(sender.sendAtomicBatch([TEST_CALL, SECOND_CALL])).rejects.toThrow(
        "The batch outcome is unknown"
      );
    });

    it("refuses an empty batch and a batch across two chains before asking", async () => {
      await expect(sender.sendAtomicBatch([])).rejects.toThrow("Cannot send empty batch");
      await expect(
        sender.sendAtomicBatch([TEST_CALL, { ...SECOND_CALL, chainId: 42220 }])
      ).rejects.toThrow("An atomic batch runs on one chain");
      expect(batchDeps.sendCalls).not.toHaveBeenCalled();
    });
  });
});
