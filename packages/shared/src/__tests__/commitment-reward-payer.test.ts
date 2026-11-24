/** @vitest-environment happy-dom */

import { onlineManager } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePromiseRewardShares } from "../hooks/commitment-pooling/useRewardShares";
import type { RewardLeg } from "../modules/commitment-pooling/reward-legs";
import { decodeFunctionData, type Hex, parseAbi, RpcRequestError, slice, sliceHex } from "viem";
import { UserOperationExecutionError } from "viem/account-abstraction";
import {
  REWARD_SAFE_ABI,
  REWARD_SAFE_MULTI_SEND,
  type RewardPayChain,
  sendRewardSafeSync,
  sendRewardSharePayment,
} from "../modules/commitment-pooling/reward-pay-send";
import { ReceiptWaitLimitError, type TransactionSender } from "../modules/transactions/types";

import {
  gardenRewardPayment,
  REWARD_PAYER_ABI,
  readRewardShareTransaction,
  rewardBeneficiarySafeMissing,
  rewardLegShares,
  rewardPayerShareId,
  rewardShareRecipientsOf,
  rewardSharesOwed,
} from "../modules/commitment-pooling/reward-payer";
import type { Address } from "../types/domain";
import { createTestQueryClient } from "./test-utils/query-client";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const mocks = vi.hoisted(() => ({ readRecipients: vi.fn() }));

// The payer counts as deployed, and garden C has a Safe recorded; garden A has none.
vi.mock("../utils/blockchain/contracts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/blockchain/contracts")>()),
  getRewardPayerDeployment: () => ({
    address: "0x4444444444444444444444444444444444444444",
    deployBlock: 1n,
  }),
  getGardenRewardSafe: (_chainId: number, garden: string | null | undefined) =>
    garden?.toLowerCase() === "0x3333333333333333333333333333333333333333"
      ? {
          safe: "0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe",
          gate: "0x6a7e6a7e6a7e6a7e6a7e6a7e6a7e6a7e6a7e6a7e",
          signerHat: 7n,
        }
      : null,
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
const usdcLeg = { rail: "garden-safe" as const, token: USDC, amount: 20_000_000n };
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

  it("owes every unpaid share but one owed to the paying Safe, and none still being read", () => {
    const SAFE = "0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe" as Address;
    const parts = [
      { recipient: A, paidBy: null },
      { recipient: B, paidBy: SAFE },
      { recipient: SAFE, paidBy: null },
      { recipient: C, paidBy: undefined },
    ];
    // A steward's own share is paid like anyone's; the payer refuses only the Safe paying itself.
    expect(rewardSharesOwed(parts, SAFE).map((share) => share.recipient)).toEqual([A]);
  });

  it("splits as the G$ plan pays: a garden that took up a Request through its Safe, else each contributor", () => {
    const rows = [
      { contributor: A, paymentWeightBps: 6_000 },
      { contributor: B, paymentWeightBps: 4_000 },
    ];
    expect(
      rewardShareRecipientsOf(
        { payoutKind: "CONTRIBUTOR_CONSIDERATION", beneficiaryGarden: null },
        rows,
        42161
      )
    ).toEqual([
      { recipient: A, weightBps: 6_000 },
      { recipient: B, weightBps: 4_000 },
    ]);
    // The USDC part goes to the taking garden's Safe, never to the garden's own account.
    const taken = { payoutKind: "GARDEN_BENEFICIARY" as const, beneficiaryGarden: C };
    expect(rewardShareRecipientsOf(taken, [], 42161)).toEqual([
      { recipient: "0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe", weightBps: 10_000 },
    ]);
    expect(rewardBeneficiarySafeMissing(taken, 42161)).toBe(false);
    // A garden with no Safe recorded receives nothing until it has one, and the Hub says so.
    const noSafe = { payoutKind: "GARDEN_BENEFICIARY" as const, beneficiaryGarden: A };
    expect(rewardShareRecipientsOf(noSafe, rows, 42161)).toEqual([]);
    expect(rewardBeneficiarySafeMissing(noSafe, 42161)).toBe(true);
  });

  it("offers USDC only to a garden whose Safe is recorded, where the payer and USDC are", () => {
    expect(gardenRewardPayment(42161, C)).toEqual({
      payer: "0x4444444444444444444444444444444444444444",
      safe: "0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe",
      gate: "0x6a7e6a7e6a7e6a7e6a7e6a7e6a7e6a7e6a7e6a7e",
      signerHat: 7n,
      token: USDC,
    });
    expect(gardenRewardPayment(42161, A)).toBeNull();
    expect(gardenRewardPayment(42161, null)).toBeNull();
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

describe("paying reward shares from the garden's Safe", () => {
  const PAYER = "0x4444444444444444444444444444444444444444" as Address;
  const SAFE = "0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe" as Address;
  const OWNER = "0x5555555555555555555555555555555555555555" as Address;
  const CO_OWNER = "0x0666666666666666666666666666666666666666" as Address;
  const GATE = "0x6a7e6a7e6a7e6a7e6a7e6a7e6a7e6a7e6a7e6a7e" as Address;
  const HAT = 7n;
  const ZERO = "0x0000000000000000000000000000000000000000" as Address;
  const HASH = `0x${"cd".repeat(32)}` as Hex;
  const shares = rewardLegShares({
    ...promise,
    leg: usdcLeg,
    recipients: [
      { recipient: A, weightBps: 6_000 },
      { recipient: B, weightBps: 4_000 },
    ],
  });

  function setup(
    read: {
      balance?: bigint;
      paidBy?: Address;
      owners?: Address[];
      threshold?: bigint;
      approvedBy?: Address[];
      /** Accounts the gate no longer counts: they no longer wear the steward hat. */
      invalid?: Address[];
      /** Accounts that don't wear the steward hat. */
      notWearing?: Address[];
      gateSafe?: Address;
      /** A passkey account, whose gas a sponsor pays. */
      sponsored?: boolean;
    } = {}
  ) {
    const chain = {
      balance: vi.fn(async () => read.balance ?? 100_000_000n),
      paidBy: vi.fn(async () => read.paidBy ?? ZERO),
      safeState: vi.fn(async () => ({
        owners: read.owners ?? [OWNER, CO_OWNER],
        threshold: read.threshold ?? 2n,
        nonce: 7n,
      })),
      safeTransactionHash: vi.fn(
        async (
          _safe: Address,
          _transaction: { to: Address; data: Hex; operation: number; nonce: bigint }
        ) => HASH
      ),
      approvedHash: vi.fn(async (_safe: Address, owner: Address) =>
        (read.approvedBy ?? []).includes(owner)
      ),
      gateState: vi.fn(async (_gate: Address, accounts: readonly Address[]) => ({
        safe: read.gateSafe ?? SAFE,
        valid: accounts.map(
          (account) => account !== GATE && !(read.invalid ?? []).includes(account)
        ),
      })),
      wearsHat: vi.fn(
        async (_gate: Address, account: Address, _hat: bigint) =>
          !(read.notWearing ?? []).includes(account) && !(read.invalid ?? []).includes(account)
      ),
    } satisfies RewardPayChain;
    const sendContractCall = vi.fn(
      async (
        _call: {
          address: Address;
          account?: Address;
          functionName: string;
          args: readonly unknown[];
        },
        _options?: { onBeforeBroadcast?: () => Promise<void> }
      ) => ({ hash: "0xabc" as Hex })
    );
    const sender = {
      sendContractCall,
      supportsSponsorship: read.sponsored ?? false,
    } as unknown as TransactionSender;
    const pay = (intent: "approve" | "pay", account: Address = OWNER) =>
      sendRewardSharePayment({
        sender,
        chain,
        chainId: 42161,
        payer: PAYER,
        safe: SAFE,
        gate: GATE,
        signerHat: HAT,
        account,
        intent,
        partShares: shares,
        shown: shares,
      });
    const sync = (account: Address = OWNER) =>
      sendRewardSafeSync({
        sender,
        chain,
        chainId: 42161,
        safe: SAFE,
        gate: GATE,
        signerHat: HAT,
        account,
      });
    return { chain, sendContractCall, pay, sync };
  }

  /** The two calls MultiSendCallOnly runs, read back from its packed bytes. */
  function multiSendCalls(data: Hex) {
    const { args } = decodeFunctionData({
      abi: parseAbi(["function multiSend(bytes transactions)"]),
      data,
    });
    const packed = args[0] as Hex;
    const calls: { operation: number; to: string; data: Hex }[] = [];
    for (let at = 0; at < (packed.length - 2) / 2; ) {
      const length = Number(BigInt(sliceHex(packed, at + 53, at + 85)));
      calls.push({
        operation: Number(BigInt(sliceHex(packed, at, at + 1))),
        to: sliceHex(packed, at + 1, at + 21),
        data: slice(packed, at + 85, at + 85 + length),
      });
      at += 85 + length;
    }
    return calls;
  }

  it("builds one Safe transaction: approve exactly the total, then pay every share", async () => {
    const { chain, pay } = setup();
    await pay("approve");
    const [, transaction] = chain.safeTransactionHash.mock.calls[0]!;
    if (!transaction) throw new Error("no Safe transaction was built");
    expect(transaction).toMatchObject({ to: REWARD_SAFE_MULTI_SEND, operation: 1, nonce: 7n });
    const [approve, payAll] = multiSendCalls(transaction.data);
    expect(approve!.operation).toBe(0);
    expect(approve!.to.toLowerCase()).toBe(USDC.toLowerCase());
    expect(
      decodeFunctionData({
        abi: parseAbi(["function approve(address,uint256)"]),
        data: approve!.data,
      }).args
    ).toEqual([PAYER, 20_000_000n]);
    expect(payAll!.operation).toBe(0);
    expect(payAll!.to.toLowerCase()).toBe(PAYER.toLowerCase());
    const decoded = decodeFunctionData({ abi: REWARD_PAYER_ABI, data: payAll!.data });
    expect(decoded.functionName).toBe("payAll");
    const paid = decoded.args[0] as unknown as readonly { recipient: Address }[];
    expect(paid.map((share) => share.recipient)).toEqual([A, B]);
  });

  it("an owner short of the threshold approves that exact transaction from their own account", async () => {
    const { sendContractCall, pay } = setup();
    await expect(pay("approve")).resolves.toEqual({
      status: "approved",
      approvals: 1,
      threshold: 2,
      confirmed: true,
    });
    expect(sendContractCall).toHaveBeenCalledTimes(1);
    expect(sendContractCall.mock.calls[0]![0]).toMatchObject({
      address: SAFE,
      account: OWNER,
      functionName: "approveHash",
      args: [HASH],
    });
    // An owner who already approved isn't asked again while the payment waits for the rest.
    const waiting = setup({ approvedBy: [OWNER] });
    await expect(waiting.pay("approve")).resolves.toEqual({
      status: "awaiting-owners",
      approvals: 1,
      threshold: 2,
    });
    expect(waiting.sendContractCall).not.toHaveBeenCalled();
  });

  it("the owner who completes the threshold runs it, with every approval in address order", async () => {
    const { sendContractCall, pay } = setup({ approvedBy: [CO_OWNER] });
    await expect(pay("pay")).resolves.toEqual({
      status: "paid",
      transactionHash: "0xabc",
      shareIds: shares.map(rewardPayerShareId),
    });
    const call = sendContractCall.mock.calls[0]![0];
    expect(call).toMatchObject({ address: SAFE, account: OWNER, functionName: "execTransaction" });
    const { args } = decodeFunctionData({
      abi: REWARD_SAFE_ABI,
      data: (await import("viem")).encodeFunctionData({
        abi: REWARD_SAFE_ABI,
        functionName: "execTransaction",
        args: call.args as never,
      }),
    });
    const signatures = args[9] as Hex;
    // Two pre-approved signatures of 65 bytes, the lower address first: the owner as r, v of 1.
    expect((signatures.length - 2) / 2).toBe(130);
    expect(sliceHex(signatures, 12, 32).toLowerCase()).toBe(CO_OWNER.toLowerCase());
    for (const at of [0, 65]) {
      expect(BigInt(sliceHex(signatures, at + 32, at + 64))).toBe(0n);
      expect(sliceHex(signatures, at + 64, at + 65)).toBe("0x01");
    }
    expect(sliceHex(signatures, 77, 97).toLowerCase()).toBe(OWNER.toLowerCase());
    // With a threshold of one, the owner pays at once.
    const alone = setup({ owners: [OWNER], threshold: 1n });
    await expect(alone.pay("pay")).resolves.toMatchObject({ status: "paid" });
    expect(alone.sendContractCall.mock.calls[0]![0].functionName).toBe("execTransaction");
    // More owners approved than it needs: still exactly as many signatures as the threshold.
    const THIRD = "0x0777777777777777777777777777777777777777" as Address;
    const crowded = setup({ owners: [OWNER, CO_OWNER, THIRD], approvedBy: [CO_OWNER, THIRD] });
    await crowded.pay("pay");
    const crowdedArgs = crowded.sendContractCall.mock.calls[0]![0].args as readonly unknown[];
    expect(((crowdedArgs[9] as Hex).length - 2) / 2).toBe(130);
  });

  it("keeps to the step the owner pressed when the approvals moved under them", async () => {
    // Pressed Approve, but another owner approved since: their signature would run the payment.
    const ranAhead = setup({ approvedBy: [CO_OWNER] });
    await expect(ranAhead.pay("approve")).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "approvals-changed",
    });
    // Pressed Pay, but the Safe moved on and its approvals start again: it would only approve.
    const movedOn = setup();
    await expect(movedOn.pay("pay")).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "approvals-changed",
    });
    expect(ranAhead.sendContractCall).not.toHaveBeenCalled();
    expect(movedOn.sendContractCall).not.toHaveBeenCalled();
  });

  it("asks for nothing when a share is paid, the Safe can't cover the total, or the account isn't a steward", async () => {
    const paid = setup({ paidBy: B });
    await expect(paid.pay("approve")).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "already-paid",
    });
    const short = setup({ balance: 19_999_999n });
    await expect(short.pay("approve")).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "insufficient-balance",
    });
    const stranger = setup({ notWearing: [C] });
    await expect(stranger.pay("approve", C)).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "not-a-steward",
    });
    const unreadable = setup();
    unreadable.chain.safeState.mockRejectedValueOnce(new Error("rpc down"));
    await expect(unreadable.pay("approve")).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "unreadable",
    });
    for (const run of [paid, short, stranger, unreadable]) {
      expect(run.sendContractCall).not.toHaveBeenCalled();
    }
  });

  it("asks a steward to bring the signers up to date before approving", async () => {
    // An owner who no longer wears the steward hat: nothing is approved until they're removed.
    const stale = setup({ invalid: [CO_OWNER] });
    await expect(stale.pay("approve")).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "needs-sync",
    });
    // A steward with no seat yet takes one first.
    const seatless = setup({ owners: [CO_OWNER], threshold: 1n });
    await expect(seatless.pay("pay")).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "needs-sync",
    });
    // The record must name the gate that guards this Safe.
    const mismatched = setup({ gateSafe: C });
    await expect(mismatched.pay("approve")).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "unreadable",
    });
    for (const run of [stale, seatless, mismatched]) {
      expect(run.sendContractCall).not.toHaveBeenCalled();
    }
  });

  it("removes signers who left the steward hat, then seats the steward, and asks nothing when current", async () => {
    const THIRD = "0x0777777777777777777777777777777777777777" as Address;
    const run = setup({ owners: [CO_OWNER, THIRD], invalid: [THIRD] });
    await expect(run.sync()).resolves.toEqual({ status: "synced", confirmed: true });
    expect(run.sendContractCall.mock.calls.map(([call]) => [call.functionName, call.args])).toEqual(
      [
        ["removeSigner", [THIRD]],
        ["claimSigner", [HAT]],
      ]
    );
    expect(run.sendContractCall.mock.calls.every(([call]) => call.address === GATE)).toBe(true);
    // A new Safe holds only its gate until the first steward claims a seat: the gate stays.
    const fresh = setup({ owners: [GATE], threshold: 1n });
    await fresh.sync();
    expect(fresh.sendContractCall.mock.calls.map(([call]) => call.functionName)).toEqual([
      "claimSigner",
    ]);
    // Signers already current: nothing to sign.
    const current = setup();
    await expect(current.sync()).resolves.toEqual({ status: "synced", confirmed: true });
    expect(current.sendContractCall).not.toHaveBeenCalled();
    // Someone not wearing the steward hat can't update the signers.
    const outsider = setup({ notWearing: [C] });
    await expect(outsider.sync(C)).resolves.toEqual({
      status: "refused-before-asking",
      refusal: "not-a-steward",
    });
  });

  it("stops at a declined signature, and says when a payment can't be confirmed yet", async () => {
    const declined = setup({ approvedBy: [CO_OWNER] });
    declined.sendContractCall.mockRejectedValueOnce(
      Object.assign(new Error("User rejected the request."), { code: 4001 })
    );
    await expect(declined.pay("pay")).resolves.toEqual({ status: "not-paid", miss: "declined" });

    // A payment past its receipt wait went out and may still land: never "not paid".
    const waited = setup({ approvedBy: [CO_OWNER] });
    waited.sendContractCall.mockImplementationOnce(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      throw new ReceiptWaitLimitError(120_000, { hash: `0x${"ab".repeat(32)}` });
    });
    await expect(waited.pay("pay")).resolves.toMatchObject({
      status: "unconfirmed",
      transactionHash: `0x${"ab".repeat(32)}`,
    });
  });

  it("says a passkey's gas sponsor refused, when nothing went out", async () => {
    const refusal = () =>
      new RpcRequestError({
        body: { jsonrpc: "2.0", id: 1, method: "pm_getPaymasterData", params: [] },
        error: { code: -32500, message: "UserOperation rejected by the sponsorship policy" },
        url: "https://paymaster.example/rpc",
      });
    const paying = setup({ approvedBy: [CO_OWNER], sponsored: true });
    paying.sendContractCall.mockRejectedValueOnce(refusal());
    await expect(paying.pay("pay")).resolves.toEqual({ status: "unsponsored" });

    const approving = setup({ sponsored: true });
    approving.sendContractCall.mockRejectedValueOnce(refusal());
    await expect(approving.pay("approve")).resolves.toEqual({ status: "unsponsored" });

    // The first update went out; the sponsor refused the second before it did.
    const syncing = setup({ owners: [CO_OWNER, GATE], invalid: [CO_OWNER], sponsored: true });
    syncing.sendContractCall.mockImplementationOnce(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      return { hash: "0xabc" as Hex };
    });
    syncing.sendContractCall.mockRejectedValueOnce(refusal());
    await expect(syncing.sync()).resolves.toEqual({ status: "unsponsored", partly: true });

    const seating = setup({ owners: [CO_OWNER, GATE], sponsored: true });
    seating.sendContractCall.mockRejectedValueOnce(refusal());
    await expect(seating.sync()).resolves.toEqual({ status: "unsponsored", partly: false });

    // A revert met while estimating names the paymaster among its arguments: still a refusal.
    const reverting = setup({ approvedBy: [CO_OWNER], sponsored: true });
    reverting.sendContractCall.mockRejectedValueOnce(
      new UserOperationExecutionError(
        new RpcRequestError({
          body: { jsonrpc: "2.0", id: 2, method: "eth_estimateUserOperationGas", params: [] },
          error: { code: -32521, message: "execution reverted: GS026" },
          url: "https://bundler.example/rpc",
        }),
        {
          callData: "0x",
          nonce: 0n,
          sender: OWNER,
          signature: "0x",
          paymaster: "0x7777777777777777777777777777777777777777",
        } as never
      )
    );
    await expect(reverting.pay("pay")).resolves.toEqual({ status: "not-paid", miss: "refused" });

    // A wallet pays its own gas: the same words don't make its failure a sponsor's refusal.
    const wallet = setup({ approvedBy: [CO_OWNER] });
    wallet.sendContractCall.mockRejectedValueOnce(refusal());
    await expect(wallet.pay("pay")).resolves.toEqual({ status: "not-paid", miss: "refused" });
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
