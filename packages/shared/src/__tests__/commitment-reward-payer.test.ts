import { describe, expect, it, vi } from "vitest";

import { sendRewardSharePayment } from "../modules/commitment-pooling/reward-pay-send";
import type { TransactionSender } from "../modules/transactions/types";

import { rewardLegShares, rewardPayerShareId } from "../modules/commitment-pooling/reward-payer";
import type { Address } from "../types/domain";

const MODULE = "0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a" as Address;
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address;
const A = "0x1111111111111111111111111111111111111111" as Address;
const B = "0x2222222222222222222222222222222222222222" as Address;
const C = "0x3333333333333333333333333333333333333333" as Address;
const usdcLeg = { rail: "steward-wallet" as const, token: USDC, amount: 20_000_000n };
const promise = { promiseChainId: 42161, promiseModule: MODULE, commitmentId: 19n };

describe("reward payer shares", () => {
  it("names a share by the same id the contract records it under", () => {
    // Pinned beside RewardPayer.t.sol's vector, and checked against `cast abi-encode` + `cast keccak`.
    expect(rewardPayerShareId({ ...promise, token: USDC, recipient: A, amount: 20_000_000n })).toBe(
      "0xb0ba81695077bb82d2c1990efdcfc726ae170fd74c321b6f46c8e51581fca378"
    );
  });

  it("pays one contributor the whole part, and splits by weight in address order", () => {
    expect(
      rewardLegShares({
        ...promise,
        leg: usdcLeg,
        recipients: [{ recipient: A, weightBps: 10_000 }],
      })
    ).toEqual([{ ...promise, token: USDC, recipient: A, amount: 20_000_000n }]);
    // Ten units in thirds leave one over: the first by address takes it, wherever it was listed.
    const thirds = rewardLegShares({
      ...promise,
      leg: { ...usdcLeg, amount: 10n },
      recipients: [
        { recipient: C, weightBps: 3_333 },
        { recipient: A, weightBps: 3_333 },
        { recipient: B, weightBps: 3_333 },
      ],
    });
    expect(thirds.map((share) => [share.recipient, share.amount])).toEqual([
      [A, 4n],
      [B, 3n],
      [C, 3n],
    ]);
    expect(thirds.reduce((sum, share) => sum + share.amount, 0n)).toBe(10n);
  });

  it("offers nothing to pay when the split can't be stated exactly", () => {
    const shares = (recipients: { recipient: Address; weightBps: number }[], leg = usdcLeg) =>
      rewardLegShares({ ...promise, leg, recipients });
    expect(shares([])).toEqual([]);
    expect(shares([{ recipient: A, weightBps: 0 }])).toEqual([]);
    expect(shares([{ recipient: A, weightBps: 1.5 }])).toEqual([]);
    expect(
      shares([
        { recipient: A, weightBps: 5_000 },
        { recipient: A.toUpperCase().replace("0X", "0x") as Address, weightBps: 5_000 },
      ])
    ).toEqual([]);
    // The G$ part is paid through settlement, never through the payer.
    expect(
      shares([{ recipient: A, weightBps: 10_000 }], {
        ...usdcLeg,
        rail: "celo-settlement" as never,
      })
    ).toEqual([]);
  });
});

describe("paying reward shares from the steward's wallet", () => {
  const PAYER = "0x4444444444444444444444444444444444444444" as Address;
  const STEWARD = "0x5555555555555555555555555555555555555555" as Address;
  const ZERO = "0x0000000000000000000000000000000000000000" as Address;
  const shares = rewardLegShares({
    ...promise,
    leg: usdcLeg,
    recipients: [
      { recipient: A, weightBps: 6_000 },
      { recipient: B, weightBps: 4_000 },
    ],
  });

  function setup(read: { allowance?: bigint; balance?: bigint; paidBy?: Address } = {}) {
    const chain = {
      allowance: vi.fn(async () => read.allowance ?? 0n),
      balance: vi.fn(async () => read.balance ?? 100_000_000n),
      paidBy: vi.fn(async () => read.paidBy ?? ZERO),
    };
    const sendContractCall = vi.fn(
      async (_call: { functionName: string; args: readonly unknown[] }) => ({
        hash: "0xabc" as `0x${string}`,
      })
    );
    const sender = { sendContractCall } as unknown as TransactionSender;
    const pay = () =>
      sendRewardSharePayment({
        sender,
        chain,
        chainId: 42161,
        payer: PAYER,
        account: STEWARD,
        shares,
      });
    return { chain, sendContractCall, pay };
  }

  it("approves exactly the total, then pays every share in one call", async () => {
    const { sendContractCall, pay } = setup();
    await expect(pay()).resolves.toEqual({
      status: "paid",
      transactionHash: "0xabc",
      shareIds: shares.map(rewardPayerShareId),
    });
    const [approve, payAll] = sendContractCall.mock.calls.map(([call]) => call);
    expect(approve).toMatchObject({ functionName: "approve", args: [PAYER, 20_000_000n] });
    expect(payAll?.functionName).toBe("payAll");
    expect((payAll?.args[0] as unknown[]).length).toBe(2);
  });

  it("approves exactly what the payment moves, even over a larger allowance", async () => {
    const exact = setup({ allowance: 20_000_000n });
    await expect(exact.pay()).resolves.toMatchObject({ status: "paid" });
    expect(exact.sendContractCall.mock.calls.map(([call]) => call.functionName)).toEqual([
      "payAll",
    ]);
    // A larger allowance left from elsewhere is brought down to the total first.
    const larger = setup({ allowance: 1_000_000_000n });
    await expect(larger.pay()).resolves.toMatchObject({ status: "paid" });
    const [approve] = larger.sendContractCall.mock.calls.map(([call]) => call);
    expect(approve).toMatchObject({ functionName: "approve", args: [PAYER, 20_000_000n] });
  });

  it("asks for nothing when a share is paid or the wallet can't cover the total", async () => {
    for (const [read, refusal] of [
      [{ paidBy: STEWARD }, "already-paid"],
      [{ balance: 19_999_999n }, "insufficient-balance"],
    ] as const) {
      const { sendContractCall, pay } = setup(read);
      await expect(pay()).resolves.toEqual({ status: "refused-before-asking", refusal });
      expect(sendContractCall).not.toHaveBeenCalled();
    }
  });

  it("stops at a declined approval, and says when a payment can't be confirmed yet", async () => {
    const declined = setup();
    declined.sendContractCall.mockRejectedValueOnce(
      Object.assign(new Error("User rejected the request."), { name: "UserRejectedRequestError" })
    );
    await expect(declined.pay()).resolves.toEqual({
      status: "not-paid",
      miss: "declined",
      approved: false,
    });
    expect(declined.sendContractCall).toHaveBeenCalledTimes(1);

    const pending = setup({ allowance: 20_000_000n });
    pending.sendContractCall.mockResolvedValueOnce({
      hash: "0xdef" as `0x${string}`,
      confirmation: "pending",
    } as never);
    await expect(pending.pay()).resolves.toMatchObject({
      status: "unconfirmed",
      transactionHash: "0xdef",
    });
  });
});
