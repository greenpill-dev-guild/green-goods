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
 * A part is split among the people the promise pays, by the payment weights its
 * G$ payout plan fixed, or whole to its one contributor when it has no plan.
 * Shares are ordered by recipient address and the rounding remainder goes to the
 * first, so every reader arrives at the same amounts.
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
 * order, the rounding remainder to the first. Empty when there is nobody to pay,
 * a weight is not a whole positive number, or a recipient is named twice: a
 * split the app can't state exactly is never offered to pay.
 */
export function rewardLegShares(input: {
  promiseChainId: number;
  promiseModule: Address;
  commitmentId: bigint;
  leg: Pick<RewardLeg, "rail" | "token" | "amount">;
  recipients: readonly RewardShareRecipient[];
}): RewardPayerShare[] {
  const { leg, recipients } = input;
  if (leg.rail !== "steward-wallet" || leg.amount <= 0n || recipients.length === 0) return [];
  if (recipients.some((entry) => !Number.isSafeInteger(entry.weightBps) || entry.weightBps <= 0)) {
    return [];
  }
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

/** One share the payer recorded as paid to a gardener, from its `RewardSharePaid` event. */
export interface RewardSharePaidReceipt {
  shareId: Hex;
  token: Address;
  amount: bigint;
  payer: Address;
  transactionHash: Hex;
}

/**
 * Every share of one promise the payer has paid to one gardener, read from its
 * events since it was deployed. A gardener needs no split to read this: the event
 * names the promise and the recipient, so their own receipts are all there is.
 */
export async function readRewardSharesPaidTo(input: {
  client: Pick<PublicClient, "getLogs">;
  payer: Address;
  fromBlock: bigint;
  commitmentId: bigint;
  recipient: Address;
}): Promise<RewardSharePaidReceipt[]> {
  const [event] = REWARD_PAYER_ABI.filter((entry) => entry.type === "event");
  const logs = await input.client.getLogs({
    address: input.payer,
    event: event as Extract<(typeof REWARD_PAYER_ABI)[number], { type: "event" }>,
    args: { commitmentId: input.commitmentId, recipient: input.recipient },
    fromBlock: input.fromBlock,
    toBlock: "latest",
  });
  return logs.flatMap((log) => {
    const args = log.args as {
      shareId?: Hex;
      token?: Address;
      amount?: bigint;
      payer?: Address;
    };
    if (
      !args.shareId ||
      !args.token ||
      args.amount === undefined ||
      !args.payer ||
      !log.transactionHash
    ) {
      return [];
    }
    return [
      {
        shareId: args.shareId,
        token: getAddress(args.token),
        amount: args.amount,
        payer: getAddress(args.payer),
        transactionHash: log.transactionHash,
      },
    ];
  });
}
