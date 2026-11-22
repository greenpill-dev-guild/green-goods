/** @vitest-environment happy-dom */

import { onlineManager } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePromiseRewardShares } from "../hooks/commitment-pooling/useRewardShares";
import type { RewardLeg } from "../modules/commitment-pooling/reward-legs";
import { sendRewardSharePayment } from "../modules/commitment-pooling/reward-pay-send";
import { ReceiptWaitLimitError, type TransactionSender } from "../modules/transactions/types";

import {
  readRewardShareTransaction,
  rewardLegShares,
  rewardPayerShareId,
  rewardShareSettled,
  rewardShareRecipientsOf,
  rewardSharesOwed,
} from "../modules/commitment-pooling/reward-payer";
import type { Address } from "../types/domain";
import { createTestQueryClient } from "./test-utils/query-client";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const mocks = vi.hoisted(() => ({ readRecipients: vi.fn() }));

// The payer counts as deployed for the share hook; the pure share functions never read it.
vi.mock("../utils/blockchain/contracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/blockchain/contracts")>()),
  getRewardPayerDeployment: () => ({
    address: "0x4444444444444444444444444444444444444444",
    deployBlock: 1n,
  }),
}));
vi.mock("../modules/commitment-pooling/data-settlement-chain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../modules/commitment-pooling/data-settlement-chain")>()),
  readPayoutShareRecipients: mocks.readRecipients,
}));

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

  it("counts the paying steward's own unpaid share as settled, and nobody else's", () => {
    const parts = [
      { recipient: A, token: USDC, paidBy: null },
      { recipient: B, token: USDC, paidBy: A },
      { recipient: C, token: USDC, paidBy: null },
    ];
    // A paid B's share, so A's own unpaid share is A's to keep.
    expect(rewardShareSettled(parts[0]!, parts)).toBe(true);
    expect(rewardShareSettled(parts[1]!, parts)).toBe(true);
    // C paid nobody, so C's share is still owed.
    expect(rewardShareSettled(parts[2]!, parts)).toBe(false);
    // A co-steward who opens the promise after A paid owes C's share, never A's own.
    const coSteward = "0x4444444444444444444444444444444444444444" as Address;
    expect(rewardSharesOwed(parts, coSteward).map((share) => share.recipient)).toEqual([C]);
    // C never pays their own share, and a share still being read is never offered.
    expect(rewardSharesOwed(parts, C)).toEqual([]);
    expect(rewardSharesOwed([{ ...parts[2]!, paidBy: undefined }], coSteward)).toEqual([]);
  });

  it("splits as the G$ plan pays: a garden that took up a Request whole, else each contributor", () => {
    const rows = [
      { contributor: A, paymentWeightBps: 6_000 },
      { contributor: B, paymentWeightBps: 4_000 },
    ];
    expect(
      rewardShareRecipientsOf(
        { payoutKind: "CONTRIBUTOR_CONSIDERATION", beneficiaryGarden: null },
        rows
      )
    ).toEqual([
      { recipient: A, weightBps: 6_000 },
      { recipient: B, weightBps: 4_000 },
    ]);
    // A garden's plan pays its Safe and has no contributor rows: the USDC part goes to that garden.
    expect(
      rewardShareRecipientsOf({ payoutKind: "GARDEN_BENEFICIARY", beneficiaryGarden: C }, [])
    ).toEqual([{ recipient: C, weightBps: 10_000 }]);
    expect(
      rewardShareRecipientsOf({ payoutKind: "GARDEN_BENEFICIARY", beneficiaryGarden: null }, rows)
    ).toEqual([]);
  });

  it("offers nothing to pay when the split can't be stated exactly", () => {
    const shares = (recipients: { recipient: Address; weightBps: number }[], leg = usdcLeg) =>
      rewardLegShares({ ...promise, leg, recipients });
    expect(shares([])).toEqual([]);
    expect(shares([{ recipient: A, weightBps: 0 }])).toEqual([]);
    expect(shares([{ recipient: A, weightBps: -1 }])).toEqual([]);
    // Someone the G$ plan gives nothing gets nothing here, and the rest still split.
    expect(
      shares([
        { recipient: A, weightBps: 10_000 },
        { recipient: B, weightBps: 0 },
      ]).map((share) => [share.recipient, share.amount])
    ).toEqual([[A, 20_000_000n]]);
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
      paidBy: vi.fn(async (_payer: Address, _shareId: `0x${string}`) => read.paidBy ?? ZERO),
    };
    const sendContractCall = vi.fn(
      async (
        _call: { functionName: string; args: readonly unknown[] },
        _options?: { onBeforeBroadcast?: () => Promise<void> }
      ) => ({
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
        partShares: shares,
        shown: shares,
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
    expect(payAll).toMatchObject({ functionName: "payAll", account: STEWARD });
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
    // A share of the payer's own would make the payer refuse the whole batch.
    const own = setup();
    await expect(
      sendRewardSharePayment({
        sender: { sendContractCall: own.sendContractCall } as unknown as TransactionSender,
        chain: own.chain,
        chainId: 42161,
        payer: PAYER,
        account: A,
        partShares: shares,
        shown: shares,
      })
    ).resolves.toEqual({ status: "refused-before-asking", refusal: "self-payment" });
    expect(own.sendContractCall).not.toHaveBeenCalled();
  });

  it("asks for nothing when the list changed since it was read, or can't be read", async () => {
    // The plan pays two stewards, A and B. A paid B's share and kept their own after B's Hub
    // read the list, which still showed A's share as owed: B must not pay it.
    const stale = setup();
    stale.chain.paidBy.mockImplementation(async (_payer, shareId) =>
      shareId === rewardPayerShareId(shares[1]!) ? A : ZERO
    );
    await expect(
      sendRewardSharePayment({
        sender: { sendContractCall: stale.sendContractCall } as unknown as TransactionSender,
        chain: stale.chain,
        chainId: 42161,
        payer: PAYER,
        account: B,
        partShares: shares,
        shown: [shares[0]!],
      })
    ).resolves.toEqual({ status: "refused-before-asking", refusal: "already-paid" });
    expect(stale.sendContractCall).not.toHaveBeenCalled();

    const down = setup();
    down.chain.balance.mockRejectedValueOnce(new Error("rpc down"));
    await expect(down.pay()).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "unreadable",
    });
    expect(down.sendContractCall).not.toHaveBeenCalled();
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

    // An approval a Safe only proposed leaves the payment to wait for it.
    const proposed = setup();
    proposed.sendContractCall.mockResolvedValueOnce({
      hash: "0xprop" as `0x${string}`,
      confirmation: "pending",
    } as never);
    await expect(proposed.pay()).resolves.toEqual({ status: "approval-pending" });
    expect(proposed.sendContractCall).toHaveBeenCalledTimes(1);

    // A payment past its receipt wait went out and may still land: never "not paid".
    const waited = setup({ allowance: 20_000_000n });
    waited.sendContractCall.mockImplementationOnce(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      throw new ReceiptWaitLimitError(120_000, { hash: `0x${"ab".repeat(32)}` });
    });
    await expect(waited.pay()).resolves.toMatchObject({
      status: "unconfirmed",
      transactionHash: `0x${"ab".repeat(32)}`,
    });
  });
});

describe("finding the transaction that paid a share", () => {
  it("searches back from the latest block in bounded spans, never past the payer's deployment", async () => {
    const spans: [bigint, bigint][] = [];
    const client = {
      getBlockNumber: vi.fn(async () => 2_100_000n),
      getLogs: vi.fn(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        spans.push([fromBlock, toBlock]);
        return fromBlock <= 1_000_000n ? [{ transactionHash: "0xpaid" }] : [];
      }),
    };
    await expect(
      readRewardShareTransaction({
        client: client as never,
        payer: "0x4444444444444444444444444444444444444444" as Address,
        fromBlock: 900_000n,
        shareId: `0x${"cd".repeat(32)}`,
      })
    ).resolves.toBe("0xpaid");
    expect(spans).toEqual([
      [1_600_001n, 2_100_000n],
      [1_100_001n, 1_600_000n],
      [900_000n, 1_100_000n],
    ]);
  });

  it("narrows a span the provider refuses, and gives up only at the floor", async () => {
    const spans: bigint[] = [];
    const client = {
      getBlockNumber: vi.fn(async () => 1_000_000n),
      getLogs: vi.fn(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        spans.push(toBlock - fromBlock + 1n);
        if (toBlock - fromBlock + 1n > 100_000n) throw new Error("block range too wide");
        return [{ transactionHash: "0xfound" }];
      }),
    };
    await expect(
      readRewardShareTransaction({
        client: client as never,
        payer: "0x4444444444444444444444444444444444444444" as Address,
        fromBlock: 0n,
        shareId: `0x${"cd".repeat(32)}`,
      })
    ).resolves.toBe("0xfound");
    expect(spans).toEqual([500_000n, 250_000n, 125_000n, 62_500n]);

    const refusing = {
      getBlockNumber: vi.fn(async () => 1_000_000n),
      getLogs: vi.fn(async () => {
        throw new Error("down");
      }),
    };
    await expect(
      readRewardShareTransaction({
        client: refusing as never,
        payer: "0x4444444444444444444444444444444444444444" as Address,
        fromBlock: 0n,
        shareId: `0x${"cd".repeat(32)}`,
      })
    ).rejects.toThrow("down");
  });
});

describe("reading a promise's shares for its reader", () => {
  const leg: RewardLeg = {
    ...usdcLeg,
    chainId: 42161,
    symbol: "USDC",
    decimals: 6,
    usdCentsAsSet: 2_000n,
  };

  // TanStack reports a read paused offline as neither loading nor failed. It still hasn't
  // answered, so no part may read as owed.
  it("reads as unanswered while a read is paused offline", async () => {
    mocks.readRecipients.mockResolvedValue({ finalized: false, recipients: [] });
    onlineManager.setOnline(false);
    try {
      const { result } = renderHookWithProviders(
        () => usePromiseRewardShares({ chainId: 42161, commitmentId: 19n, legs: [leg] }),
        { queryClient: createTestQueryClient() }
      );
      expect(result.current.isReading).toBe(true);
      expect(result.current.readFailed).toBe(false);
      expect(mocks.readRecipients).not.toHaveBeenCalled();

      onlineManager.setOnline(true);
      await waitFor(() => expect(result.current.isReading).toBe(false));
      expect(result.current.splitFixed).toBe(false);
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
