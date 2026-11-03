/**
 * Edit Reward: every untaken copy of a group gets the new reward, in one
 * approval where the wallet can batch, and a copy the wallet declined keeps its
 * old one. The wallet is a fake that records the calls it was asked to send.
 */

import { describe, expect, it, vi } from "vitest";

import {
  goodDollarConsideration,
  rewardEditBudget,
  sendRewardEdit,
} from "../modules/commitment-pooling/reward-edit";
import type { AtomicBatchAction } from "../modules/transactions/batch-enablement";
import type {
  AtomicBatchOptions,
  ContractCall,
  TransactionSender,
  TransactionSendOptions,
} from "../modules/transactions/types";
import type { Address } from "../types/domain";

const MODULE = "0x9999999999999999999999999999999999999999" as Address;
const ZERO = "0x0000000000000000000000000000000000000000";
const TX = `0x${"cd".repeat(32)}` as const;
const DECLINED = () => new Error("User rejected the request.");
/** $4.00 at the reserve's 2026-09-30 price. */
const FOUR_DOLLARS = 31_092_610_484_772_112_991_254n;

function wallet(options: {
  bundles: boolean;
  decline?: (call: ContractCall) => boolean;
  /** A Safe-style wallet: it hands back an id with no receipt to check. */
  pending?: boolean;
}) {
  const asked: ContractCall[][] = [];
  const answer = async (calls: ContractCall[]) => {
    asked.push(calls);
    if (calls.some((call) => options.decline?.(call))) throw DECLINED();
    return { hash: TX, sponsored: false, ...(options.pending ? { confirmation: "pending" } : {}) };
  };
  const sender = {
    authMode: "wallet",
    supportsBatching: false,
    supportsSponsorship: false,
    canSendAtomicBatch: vi.fn(async () => options.bundles),
    sendAtomicBatch: vi.fn((calls: ContractCall[]) => answer(calls)),
    sendContractCall: vi.fn((call: ContractCall) => answer([call])),
  } as unknown as TransactionSender;
  return { sender, asked };
}

/**
 * A passkey signs before anything can go out, so its own refusals (a closed
 * prompt, a sponsor that says no, a group past its ceilings) change nothing.
 * It groups only for an action listed for it.
 */
function passkey(options: {
  listed?: readonly AtomicBatchAction[];
  unsent?: (call: ContractCall) => Error | null;
  pastCeilings?: boolean;
}) {
  const asked: ContractCall[][] = [];
  const sender = {
    authMode: "passkey",
    supportsBatching: false,
    supportsSponsorship: true,
    canSendAtomicBatch: vi.fn(async (_chainId: number, action?: AtomicBatchAction) =>
      Boolean(action && options.listed?.includes(action))
    ),
    sendAtomicBatch: vi.fn(async (calls: ContractCall[], batch?: AtomicBatchOptions) => {
      if (options.pastCeilings) {
        batch?.onNeverSent?.();
        throw new Error("batch-budget-exceeded");
      }
      asked.push(calls);
      return { hash: TX, sponsored: true };
    }),
    sendContractCall: vi.fn(async (call: ContractCall, sendOptions?: TransactionSendOptions) => {
      const refusal = options.unsent?.(call);
      if (refusal) throw refusal;
      await sendOptions?.onBeforeBroadcast?.();
      asked.push([call]);
      return { hash: TX, sponsored: true };
    }),
  } as unknown as TransactionSender;
  return { sender, asked };
}

const edit = (sender: TransactionSender, commitmentIds: bigint[], oneByOne = false) =>
  sendRewardEdit({
    sender,
    chainId: 42161,
    moduleAddress: MODULE,
    commitmentIds,
    consideration: goodDollarConsideration(FOUR_DOLLARS),
    oneByOne,
  });

describe("Edit Reward", () => {
  it("asks once for every copy nobody has taken, each set to the new G$ reward", async () => {
    const { sender, asked } = wallet({ bundles: true });

    const ended = await edit(sender, [3n, 4n, 5n, 6n]);

    expect(asked).toHaveLength(1);
    expect(asked[0]!.map((call) => [call.functionName, call.args])).toEqual(
      [3n, 4n, 5n, 6n].map((id) => [
        "setDeclaredConsideration",
        [id, { rail: 2, source: ZERO, token: ZERO, amount: FOUR_DOLLARS }],
      ])
    );
    expect(ended.map((copy) => copy.status)).toEqual(Array(4).fill("changed"));
  });

  it("changes none when the wallet declines the one request", async () => {
    const { sender } = wallet({ bundles: true, decline: () => true });

    const ended = await edit(sender, [3n, 4n]);

    expect(ended).toEqual([
      { commitmentId: 3n, status: "not-changed", miss: "declined", txHash: null },
      { commitmentId: 4n, status: "not-changed", miss: "declined", txHash: null },
    ]);
  });

  it("asks once per copy on a wallet that can't batch, and a declined one keeps its reward", async () => {
    const { sender, asked } = wallet({
      bundles: false,
      decline: (call) => call.args[0] === 4n,
    });

    const ended = await edit(sender, [3n, 4n, 5n]);

    expect(asked).toHaveLength(3);
    expect(ended.map((copy) => [copy.commitmentId, copy.status])).toEqual([
      [3n, "changed"],
      [4n, "not-changed"],
      [5n, "changed"],
    ]);
  });

  it("never reads a change a Safe-style wallet can't confirm yet as made", async () => {
    for (const bundles of [true, false]) {
      const { sender } = wallet({ bundles, pending: true });

      const ended = await edit(sender, [3n, 4n]);

      // Not changed, and possibly changed later: Try Again sets the same amount, which is safe.
      expect(ended).toEqual([
        { commitmentId: 3n, status: "not-changed", miss: "failed", txHash: TX },
        { commitmentId: 4n, status: "not-changed", miss: "failed", txHash: TX },
      ]);
    }
  });

  it("changes rewards from a passkey once per copy while reward edits aren't listed for it", async () => {
    const closed = Object.assign(new Error("Failed to request credential."), {
      cause: Object.assign(new Error("The operation was not allowed."), {
        name: "NotAllowedError",
      }),
    });
    const { sender, asked } = passkey({
      listed: ["commitment-creations"],
      unsent: (call) =>
        call.args[0] === 4n ? closed : call.args[0] === 5n ? new Error("sponsorship denied") : null,
    });

    const ended = await edit(sender, [3n, 4n, 5n]);

    expect(sender.canSendAtomicBatch).toHaveBeenCalledWith(42161, "reward-edits");
    expect(asked).toEqual([[expect.objectContaining({ args: [3n, expect.anything()] })]]);
    // Neither refusal got past the passkey, so both rewards are as they were.
    expect(ended.map((copy) => [copy.commitmentId, copy.status, copy.miss])).toEqual([
      [3n, "changed", undefined],
      [4n, "not-changed", "declined"],
      [5n, "not-changed", "refused"],
    ]);
  });

  it("asks a listed passkey once for the group, within the measured ceilings", async () => {
    const { sender, asked } = passkey({ listed: ["reward-edits"] });

    const ended = await edit(sender, [3n, 4n, 5n, 6n]);

    expect(asked).toHaveLength(1);
    expect(asked[0]).toHaveLength(4);
    expect(vi.mocked(sender.sendAtomicBatch!).mock.calls[0]![1]?.batchBudget).toEqual(
      rewardEditBudget(42161)
    );
    expect(ended.map((copy) => copy.status)).toEqual(Array(4).fill("changed"));
  });

  it("changes nothing past a passkey's ceilings, and asks once per copy on the next try", async () => {
    const { sender, asked } = passkey({ listed: ["reward-edits"], pastCeilings: true });

    const past = await edit(sender, [3n, 4n]);
    expect(past.map((copy) => [copy.status, copy.miss])).toEqual([
      ["not-changed", "over-ceilings"],
      ["not-changed", "over-ceilings"],
    ]);

    const again = await edit(sender, [3n, 4n], true);
    expect(sender.sendAtomicBatch).toHaveBeenCalledTimes(1);
    expect(asked).toHaveLength(2);
    expect(again.map((copy) => copy.status)).toEqual(["changed", "changed"]);
  });

  it("records no reward as the None rail with nothing named, the only shape the contract accepts", () => {
    expect(goodDollarConsideration(0n)).toEqual({ rail: 0, source: ZERO, token: ZERO, amount: 0n });
  });
});
