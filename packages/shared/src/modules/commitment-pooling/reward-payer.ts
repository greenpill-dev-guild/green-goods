/**
 * Paying a reward's wallet-paid parts
 *
 * A part of a promise's reward that isn't G$ is paid from the steward's own
 * wallet through the reward payer (`RewardPayer.sol`, PRD-1556). The payer
 * knows nothing about promises: a share names the promise, the token, the
 * gardener and the exact amount, and the payer moves exactly that amount once.
 * So the share has to be computed the same way everywhere, here, in the
 * indexer and by anyone checking a receipt: this module owns that computation.
 *
 * A part is split among the people the promise's G$ payout plan pays, by the
 * payment weights that plan fixed. Someone the plan gives nothing (weight zero)
 * gets nothing here either. Shares are ordered by recipient address and the
 * rounding remainder goes to the first, so every reader arrives at the same
 * amounts.
 *
 * @module modules/commitment-pooling/reward-payer
 */

import { encodeAbiParameters, getAddress, type Hex, keccak256, type PublicClient } from "viem";
import type { Address } from "../../types/domain";
import type { RewardLeg } from "./reward-legs";

export const REWARD_PAYER_ABI = [
  {
    type: "function",
    name: "paidBy",
    stateMutability: "view",
    inputs: [{ name: "shareId", type: "bytes32" }],
    outputs: [{ name: "payer", type: "address" }],
  },
  {
    type: "function",
    name: "payAll",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "shares",
        type: "tuple[]",
        components: [
          { name: "promiseChainId", type: "uint256" },
          { name: "promiseModule", type: "address" },
          { name: "commitmentId", type: "uint256" },
          { name: "token", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "shareIds", type: "bytes32[]" }],
  },
  {
    type: "event",
    name: "RewardSharePaid",
    inputs: [
      { name: "shareId", type: "bytes32", indexed: true },
      { name: "commitmentId", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "promiseChainId", type: "uint256", indexed: false },
      { name: "promiseModule", type: "address", indexed: false },
    ],
  },
] as const;

/** One gardener's share of one wallet-paid part, as the payer records it. */
export interface RewardPayerShare {
  promiseChainId: number;
  promiseModule: Address;
  commitmentId: bigint;
  token: Address;
  recipient: Address;
  amount: bigint;
}

/** Someone the promise pays, and their weight in its payout. */
export interface RewardShareRecipient {
  recipient: Address;
  /** Basis points; the weights are normalized, so they need not add to 10,000. */
  weightBps: number;
}

/** The id the payer records a share under: the hash of everything it names, as `shareIdOf`. */
export function rewardPayerShareId(share: RewardPayerShare): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
      ],
      [
        BigInt(share.promiseChainId),
        share.promiseModule,
        share.commitmentId,
        share.token,
        share.recipient,
        share.amount,
      ]
    )
  );
}

/**
 * The shares a wallet-paid part splits into: by weight, in recipient address
 * order, the rounding remainder to the first. Recipients the plan gives nothing
 * are left out. Empty when nobody is left to pay, a weight is not a whole
 * non-negative number, or a recipient is named twice: a split the app can't
 * state exactly is never offered to pay.
 */
export function rewardLegShares(input: {
  promiseChainId: number;
  promiseModule: Address;
  commitmentId: bigint;
  leg: Pick<RewardLeg, "rail" | "token" | "amount">;
  recipients: readonly RewardShareRecipient[];
}): RewardPayerShare[] {
  const { leg } = input;
  if (
    input.recipients.some((entry) => !Number.isSafeInteger(entry.weightBps) || entry.weightBps < 0)
  ) {
    return [];
  }
  const recipients = input.recipients.filter((entry) => entry.weightBps > 0);
  if (leg.rail !== "steward-wallet" || leg.amount <= 0n || recipients.length === 0) return [];
  const ordered = recipients
    .map((entry) => ({ recipient: getAddress(entry.recipient), weight: BigInt(entry.weightBps) }))
    .sort((a, b) => (a.recipient.toLowerCase() < b.recipient.toLowerCase() ? -1 : 1));
  if (new Set(ordered.map((entry) => entry.recipient)).size !== ordered.length) return [];
  const total = ordered.reduce((sum, entry) => sum + entry.weight, 0n);
  const amounts = ordered.map((entry) => (leg.amount * entry.weight) / total);
  const remainder = leg.amount - amounts.reduce((sum, amount) => sum + amount, 0n);
  amounts[0] = (amounts[0] ?? 0n) + remainder;
  return ordered
    .map((entry, index) => ({
      promiseChainId: input.promiseChainId,
      promiseModule: getAddress(input.promiseModule),
      commitmentId: input.commitmentId,
      token: getAddress(leg.token),
      recipient: entry.recipient,
      amount: amounts[index] ?? 0n,
    }))
    .filter((share) => share.amount > 0n);
}

/**
 * Whether a share needs nothing more: the payer recorded it as paid, or it is the
 * paying steward's own. The payer refuses a payment to oneself, so a steward the
 * split also pays leaves their own share unpaid on chain while paying everyone
 * else's; an unpaid share whose recipient paid another share of the same part is
 * that steward's.
 */
export function rewardShareSettled(
  share: { recipient: Address; token: Address; paidBy: Address | null | undefined },
  shares: readonly { token: Address; paidBy: Address | null | undefined }[]
): boolean {
  if (share.paidBy) return true;
  const recipient = share.recipient.toLowerCase();
  const token = share.token.toLowerCase();
  return shares.some(
    (other) => other.token.toLowerCase() === token && other.paidBy?.toLowerCase() === recipient
  );
}

/**
 * The shares one account would still pay: read as unpaid, not settled as another
 * steward's own, and not the account's own. One list for the Hub's Pay button and
 * the payment, so a co-steward is never asked to pay a share a steward already kept.
 */
export function rewardSharesOwed<
  Share extends { recipient: Address; token: Address; paidBy: Address | null | undefined },
>(shares: readonly Share[], payingAccount: Address | null | undefined): Share[] {
  const account = payingAccount?.toLowerCase();
  return shares.filter(
    (share) =>
      share.paidBy === null &&
      share.recipient.toLowerCase() !== account &&
      !rewardShareSettled(share, shares)
  );
}

/** How many blocks one log query spans at first; public Arbitrum RPCs refuse much wider ranges. */
const RECEIPT_SCAN_SPAN = 500_000n;
/** The narrowest span tried when a provider refuses a wider one. */
const RECEIPT_SCAN_MIN_SPAN = 10_000n;

/**
 * The transaction that paid one share, found from the payer's `RewardSharePaid`
 * event for that share id. It searches back from the latest block in bounded
 * spans, so it keeps working as the chain grows past what one query may span,
 * and halves a span a provider refuses, down to a floor, before giving up.
 * Null when no span from the payer's deployment on holds it.
 */
export async function readRewardShareTransaction(input: {
  client: Pick<PublicClient, "getLogs" | "getBlockNumber">;
  payer: Address;
  fromBlock: bigint;
  shareId: Hex;
}): Promise<Hex | null> {
  const [event] = REWARD_PAYER_ABI.filter((entry) => entry.type === "event");
  let span = RECEIPT_SCAN_SPAN;
  let toBlock = await input.client.getBlockNumber();
  while (toBlock >= input.fromBlock) {
    const fromBlock = toBlock - input.fromBlock >= span ? toBlock - span + 1n : input.fromBlock;
    let logs: Awaited<ReturnType<typeof input.client.getLogs>>;
    try {
      logs = await input.client.getLogs({
        address: input.payer,
        event: event as Extract<(typeof REWARD_PAYER_ABI)[number], { type: "event" }>,
        args: { shareId: input.shareId },
        fromBlock,
        toBlock,
      });
    } catch (error) {
      if (span <= RECEIPT_SCAN_MIN_SPAN) throw error;
      span = span / 2n > RECEIPT_SCAN_MIN_SPAN ? span / 2n : RECEIPT_SCAN_MIN_SPAN;
      continue;
    }
    const found = logs.find((log) => log.transactionHash);
    if (found?.transactionHash) return found.transactionHash;
    if (fromBlock === input.fromBlock) break;
    toBlock = fromBlock - 1n;
  }
  return null;
}
