import { describe, expect, it, vi } from "vitest";
import { toEventSelector } from "viem";
import type { Config } from "@wagmi/core";
import { reconcileWalletBroadcast } from "../../modules/transactions/wallet-reconciliation";
import { WalletSender } from "../../modules/transactions/wallet-sender";
const account = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;
const block = `0x${"ab".repeat(32)}` as const;
const transaction = `0x${"cd".repeat(32)}` as const;
const reference = {
  kind: "transaction",
  hash: "0xSafeProposal",
  account,
  chainId: 11155111,
} as const;
const config = {} as Config;
function fixture() {
  return {
    walletReceipt: vi.fn().mockResolvedValue({
      blockHash: block,
      transactionIndex: "0x1",
      transactionHash: reference.hash,
    }),
    blockTransactions: vi.fn().mockResolvedValue([block, transaction]),
    executionReceipt: vi.fn().mockResolvedValue({
      blockHash: block,
      transactionHash: transaction,
      status: "success",
      logs: [],
    }),
  };
}
describe("wallet proposal reconciliation", () => {
  it("recovers the real execution hash from the wallet's rewritten receipt", async () => {
    const reads = fixture();
    const resolve = (ref: Parameters<typeof reconcileWalletBroadcast>[1]) =>
      reconcileWalletBroadcast(config, ref, account, reads);
    const write = vi.fn();
    const sender = new WalletSender(config, write, undefined, {
      waitForTransactionReceipt: vi.fn(),
      reconcileBroadcast: resolve,
    });
    expect(await sender.reconcileBroadcast(JSON.parse(JSON.stringify(reference)))).toEqual({
      status: "confirmed",
      transactionHash: transaction,
    });
    expect(reads.walletReceipt).toHaveBeenCalledWith(reference.hash, 11155111);
    expect(reads.executionReceipt).toHaveBeenCalledWith(transaction, 11155111);
    expect(write).not.toHaveBeenCalled();
  });
  it.each(["reverted", "safe-failure"])("recognizes %s execution", async (failure) => {
    const reads = fixture();
    reads.executionReceipt.mockResolvedValue({
      blockHash: block,
      transactionHash: transaction,
      status: failure === "reverted" ? "reverted" : "success",
      logs:
        failure === "safe-failure"
          ? [{ address: account, topics: [toEventSelector("ExecutionFailure(bytes32,uint256)")] }]
          : [],
    });
    expect(await reconcileWalletBroadcast(config, reference, account, reads)).toEqual({
      status: "reverted",
    });
  });
  it("does not mistake another contract's failure for the signing Safe's failure", async () => {
    const reads = fixture();
    reads.executionReceipt.mockResolvedValue({
      blockHash: block,
      transactionHash: transaction,
      status: "success",
      logs: [{ address: other, topics: [toEventSelector("ExecutionFailure(bytes32,uint256)")] }],
    });
    expect(await reconcileWalletBroadcast(config, reference, account, reads)).toEqual({
      status: "confirmed",
      transactionHash: transaction,
    });
  });
  it("keeps unavailable, unexecuted and mismatched evidence pending", async () => {
    const reads = fixture();
    reads.walletReceipt.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Offline"));
    for (let i = 0; i < 2; i++)
      expect(await reconcileWalletBroadcast(config, reference, account, reads)).toEqual({
        status: "unresolved",
      });
    reads.executionReceipt.mockResolvedValue({
      blockHash: transaction,
      transactionHash: transaction,
      status: "success",
      logs: [],
    });
    expect(await reconcileWalletBroadcast(config, reference, account, reads)).toEqual({
      status: "unresolved",
    });
  });
  it("refuses a different account and malformed block positions before public reads", async () => {
    const reads = fixture();
    expect(await reconcileWalletBroadcast(config, reference, other, reads)).toEqual({
      status: "unresolved",
    });
    expect(reads.walletReceipt).not.toHaveBeenCalled();
    reads.walletReceipt.mockResolvedValue({
      blockHash: block,
      transactionIndex: "0x10000000000000000",
    });
    expect(await reconcileWalletBroadcast(config, reference, account, reads)).toEqual({
      status: "unresolved",
    });
    expect(reads.blockTransactions).not.toHaveBeenCalled();
  });
});
