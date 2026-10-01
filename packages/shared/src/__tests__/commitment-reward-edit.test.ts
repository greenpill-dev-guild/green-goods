/**
 * Edit Reward: every untaken copy of a group gets the new reward, in one
 * approval where the wallet can batch, and a copy the wallet declined keeps its
 * old one. The wallet is a fake that records the calls it was asked to send.
 */

import { describe, expect, it, vi } from "vitest";

import { goodDollarConsideration, sendRewardEdit } from "../modules/commitment-pooling/reward-edit";
import type { ContractCall, TransactionSender } from "../modules/transactions/types";
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

const edit = (sender: TransactionSender, commitmentIds: bigint[]) =>
  sendRewardEdit({
    sender,
    chainId: 42161,
    moduleAddress: MODULE,
    commitmentIds,
    consideration: goodDollarConsideration(FOUR_DOLLARS),
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

  it("records no reward as the None rail with nothing named, the only shape the contract accepts", () => {
    expect(goodDollarConsideration(0n)).toEqual({ rail: 0, source: ZERO, token: ZERO, amount: 0n });
  });
});
