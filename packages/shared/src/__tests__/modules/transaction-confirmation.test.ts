import { describe, expect, it, vi } from "vitest";
import {
  reconcileTransaction,
  sendCheckpointedCall,
} from "../../modules/transactions/confirmation";
import {
  assertTypedDataChain,
  TransactionRevertedError,
  type TransactionSender,
  type TxResult,
  type TransactionSendOptions,
} from "../../modules/transactions/types";

const hash = `0x${"ab".repeat(32)}` as const;
const sender = { sendContractCall: vi.fn() } as unknown as TransactionSender;
describe("transaction confirmation", () => {
  it("never passes an opaque proposal to a receipt reader", async () => {
    const read = vi.fn();
    expect(
      await reconcileTransaction(sender, { hash: "0xProposal", sponsored: false }, read)
    ).toEqual({ status: "unresolved" });
    expect(read).not.toHaveBeenCalled();
  });
  it.each(["success", "reverted"] as const)("recognizes a canonical %s receipt", async (status) => {
    const read = vi.fn().mockResolvedValue({ status, transactionHash: hash });
    const outcome = await reconcileTransaction(sender, { hash, sponsored: false }, read);
    expect(outcome.status).toBe(status === "success" ? "confirmed" : "reverted");
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });
  it("keeps unavailable evidence unresolved", async () => {
    const read = vi.fn().mockRejectedValue(new Error("RPC unavailable"));
    expect(await reconcileTransaction(sender, { hash, sponsored: false }, read)).toEqual({
      status: "unresolved",
    });
  });
  it("uses a wallet resolver for an opaque proposal without another send", async () => {
    const resolve = vi.fn().mockResolvedValue({ status: "confirmed", transactionHash: hash });
    const read = vi.fn();
    expect(
      await reconcileTransaction(
        { ...sender, reconcileBroadcast: resolve },
        { hash: "0xProposal", sponsored: false },
        read
      )
    ).toEqual({ status: "confirmed", transactionHash: hash });
    expect(read).not.toHaveBeenCalled();
  });
});

const call = {
  address: "0x1111111111111111111111111111111111111111",
  abi: [],
  functionName: "register",
  args: [],
  chainId: 11155111,
} as const;
describe("broadcast checkpoint", () => {
  it("retains a lost broadcast response and restores its UserOperation reference", async () => {
    let persisted: TxResult | undefined;
    const reference = { kind: "user-operation", hash, chainId: call.chainId } as const;
    const sending = {
      ...sender,
      supportsSponsorship: true,
      sendContractCall: vi.fn(async (_call, options: TransactionSendOptions) => {
        await options.onBeforeBroadcast?.(reference);
        expect(persisted?.broadcastReference).toEqual(reference);
        throw new Error("Lost response after broadcast");
      }),
    };
    const result = await sendCheckpointedCall(
      sending,
      call,
      (value) => {
        persisted = value;
      },
      vi.fn()
    );
    const restored = JSON.parse(JSON.stringify(persisted)) as TxResult;
    expect(result.confirmation).toBe("pending");
    const read = vi.fn();
    const resolver = vi.fn().mockResolvedValue({ status: "confirmed", transactionHash: hash });
    expect(
      await reconcileTransaction({ ...sending, reconcileBroadcast: resolver }, restored, read)
    ).toEqual({ status: "confirmed", transactionHash: hash });
    expect(resolver).toHaveBeenCalledWith(reference);
    expect(read).not.toHaveBeenCalled();
    expect(sending.sendContractCall).toHaveBeenCalledOnce();
  });
  it("does not interpret a UserOperation hash as an execution transaction", async () => {
    const read = vi.fn();
    expect(
      await reconcileTransaction(
        sender,
        { hash, sponsored: true, broadcastReference: { kind: "user-operation", hash } },
        read
      )
    ).toEqual({ status: "unresolved" });
    expect(read).not.toHaveBeenCalled();
  });
  it("clears a failed checkpoint before a broadcast can occur", async () => {
    const broadcast = vi.fn();
    const clear = vi.fn();
    const sending = {
      ...sender,
      sendContractCall: vi.fn(async (_call, options: TransactionSendOptions) => {
        await options.onBeforeBroadcast?.({ kind: "user-operation", hash });
        broadcast();
        return { hash, sponsored: true };
      }),
    };
    await expect(
      sendCheckpointedCall(
        sending,
        call,
        () => {
          throw new Error("Storage unavailable");
        },
        clear
      )
    ).rejects.toThrow("Storage unavailable");
    expect(clear).toHaveBeenCalledOnce();
    expect(broadcast).not.toHaveBeenCalled();
  });
  it("clears a proven revert and leaves a rejected prompt retryable", async () => {
    const clear = vi.fn();
    const sending = {
      ...sender,
      sendContractCall: vi.fn(async (_call, options: TransactionSendOptions) => {
        await options.onBroadcastReference?.({ kind: "user-operation", hash });
        throw new TransactionRevertedError(hash);
      }),
    };
    await expect(sendCheckpointedCall(sending, call, vi.fn(), clear)).rejects.toThrow(
      TransactionRevertedError
    );
    expect(clear).toHaveBeenCalledOnce();
    sending.sendContractCall.mockRejectedValueOnce(new Error("User rejected"));
    clear.mockClear();
    await expect(sendCheckpointedCall(sending, call, vi.fn(), clear)).rejects.toThrow(
      "User rejected"
    );
    expect(clear).not.toHaveBeenCalled();
  });
});

describe("typed-data signing chain", () => {
  it.each([
    11155111,
    11155111n,
  ])("accepts an equivalent numeric domain chain %s", (domainChainId) => {
    expect(() =>
      assertTypedDataChain({
        account: call.address,
        chainId: call.chainId,
        data: {
          domain: { chainId: domainChainId },
          types: { Test: [] },
          primaryType: "Test",
          message: {},
        },
      })
    ).not.toThrow();
  });
  it.each([
    1,
    1n,
    undefined,
    9007199254740993n,
  ])("rejects a missing or different domain chain %s", (domainChainId) => {
    expect(() =>
      assertTypedDataChain({
        account: call.address,
        chainId: call.chainId,
        data: {
          domain: { chainId: domainChainId },
          types: { Test: [] },
          primaryType: "Test",
          message: {},
        },
      })
    ).toThrow("typed-data-chain-mismatch");
  });
});
