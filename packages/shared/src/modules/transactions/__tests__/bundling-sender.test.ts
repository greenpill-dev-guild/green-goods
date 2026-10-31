import { describe, expect, it, vi } from "vitest";
import { createMockContractCall } from "../../../__tests__/test-utils/transaction-fakes";
import { createBundlingSender } from "../bundling-sender";
import { BatchConfirmationPendingError } from "../batch-types";
import type { AtomicBatchOptions, ContractCall, TransactionSender } from "../types";

const hash = `0x${"a".repeat(64)}` as const;
const reference = {
  kind: "wallet-calls",
  id: "opaque:group",
  chainId: 42161,
  account: "0x1111111111111111111111111111111111111111",
} as const;
function base(send: NonNullable<TransactionSender["sendAtomicBatch"]>): TransactionSender {
  return {
    authMode: "wallet",
    supportsBatching: false,
    supportsSponsorship: true,
    sendContractCall: vi.fn(),
    sendAtomicBatch: send,
  };
}
describe("bundling sender checkpoints", () => {
  it("propagates the accepted reference to every participant before the receipt", async () => {
    const records: string[] = [];
    const sender = base(async (_calls, options) => {
      await options?.onBatchReference?.(reference);
      expect(records).toEqual(["first", "second"]);
      return { hash, sponsored: true };
    });
    const bundle = createBundlingSender(sender, ["a", "b"]);
    const first = bundle.senderFor("a").sendContractCall(createMockContractCall(), {
      onBatchReference: async () => {
        records.push("first");
      },
    });
    const second = bundle.senderFor("b").sendContractCall(createMockContractCall(), {
      onBatchReference: async () => {
        records.push("second");
      },
    });
    expect(await Promise.all([first, second])).toEqual([
      { hash, sponsored: true },
      { hash, sponsored: true },
    ]);
    expect(await bundle.outcome).toMatchObject({ status: "sent" });
  });
  it("preserves the original uncertain submission for every participant", async () => {
    const error = new BatchConfirmationPendingError({
      status: "unresolved",
      reference,
      receipts: [],
      sponsored: false,
    });
    const bundle = createBundlingSender(
      base(async (_calls, options) => {
        await options?.onBatchReference?.(reference);
        throw error;
      }),
      ["a", "b"]
    );
    const received = vi.fn();
    const answers = await Promise.allSettled([
      bundle
        .senderFor("a")
        .sendContractCall(createMockContractCall(), { onBatchReference: received }),
      bundle
        .senderFor("b")
        .sendContractCall(createMockContractCall(), { onBatchReference: received }),
    ]);
    expect(answers).toEqual([
      { status: "rejected", reason: error },
      { status: "rejected", reason: error },
    ]);
    expect(received).toHaveBeenCalledTimes(2);
    expect(await bundle.outcome).toMatchObject({ status: "failed" });
  });
  it("rechecks each participant's ownership at the adapter send boundary", async () => {
    let current = true;
    const send = vi.fn(async (_calls: ContractCall[], options?: AtomicBatchOptions) => {
      current = false;
      await options?.assertOwnership?.();
      return { hash, sponsored: false };
    });
    const bundle = createBundlingSender(base(send), ["a"]);
    await expect(
      bundle.senderFor("a").sendContractCall(createMockContractCall(), {
        assertOwnership: async () => {
          if (!current) throw new Error("ownership changed");
        },
      })
    ).rejects.toThrow("ownership changed");
    expect(await bundle.outcome).toMatchObject({ status: "failed" });
  });
  it("allows a no-op participant to finish without holding the other call", async () => {
    const send = vi.fn(async () => ({ hash, sponsored: false }));
    const bundle = createBundlingSender(base(send), ["a", "b"]);
    const call = bundle.senderFor("a").sendContractCall(createMockContractCall());
    expect(send).not.toHaveBeenCalled();
    bundle.finished("b");
    expect(await call).toMatchObject({ hash });
    expect(send).toHaveBeenCalledOnce();
  });
});

it("retains the original adapter's recovery methods for a returning job", async () => {
  const sender = base(async () => ({ hash, sponsored: false }));
  sender.reconcileBatch = vi.fn<NonNullable<TransactionSender["reconcileBatch"]>>(async () => ({
    status: "confirmed",
    reference,
    receipts: [{ transactionHash: hash, status: "success" }],
    sponsored: false,
  }));
  const bundle = createBundlingSender(sender, ["a"]);
  expect((await bundle.senderFor("a").reconcileBatch?.(reference))?.status).toBe("confirmed");
  expect(sender.reconcileBatch).toHaveBeenCalledWith(reference);
  bundle.finished("a");
  expect(await bundle.outcome).toEqual({ status: "empty" });
});

it.each([
  "batch",
  "broadcast",
] as const)("notifies every participant of an accepted %s even when an earlier checkpoint fails", async (kind) => {
  const failure = new Error("storage unavailable");
  const broadcast = { kind: "user-operation", hash, chainId: reference.chainId } as const;
  const received = vi.fn(async () => undefined);
  const bundle = createBundlingSender(
    base(async (_calls, options) => {
      if (kind === "batch") await options?.onBatchReference?.(reference);
      else await options?.onBroadcastReference?.(broadcast);
      return { hash, sponsored: false };
    }),
    ["a", "b"]
  );
  const failing = async () => {
    throw failure;
  };
  const answers = await Promise.allSettled([
    bundle.senderFor("a").sendContractCall(createMockContractCall(), {
      onBatchReference: failing,
      onBroadcastReference: failing,
    }),
    bundle.senderFor("b").sendContractCall(createMockContractCall(), {
      onBatchReference: received,
      onBroadcastReference: received,
    }),
  ]);
  expect(received).toHaveBeenCalledWith(kind === "batch" ? reference : broadcast);
  expect(answers).toEqual([
    { status: "rejected", reason: failure },
    { status: "rejected", reason: failure },
  ]);
  expect(await bundle.outcome).toMatchObject({ status: "failed" });
});
