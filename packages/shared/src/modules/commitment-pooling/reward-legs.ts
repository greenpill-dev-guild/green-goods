/**
 * A promise's reward, part by part
 *
 * A reward can pay in more than one token (PRD-1556). The G$ part is the
 * promise's on-chain consideration: G$ on Celo, paid through settlement from
 * the paying garden's Safe. Any other part is declared in the promise's
 * metadata at Create and paid from the steward's own wallet. A reward with only
 * a G$ part reads exactly as it did before there were parts.
 *
 * Tokens come from the app's token registry (`config/tokens`), which pins each
 * one's symbol and decimals on its chain. A declared part in a token the
 * registry doesn't list can't be shown truthfully, so the reward says it is
 * incomplete rather than leave the part out.
 *
 * @module modules/commitment-pooling/reward-legs
 */

import type { CommitmentComposerValues } from "../../hooks/commitment-pooling/useCommitmentComposerForm";
import { CELO_G_DOLLAR_TOKEN, getStablecoinSendableTokens } from "../../config/tokens";
import type { Address } from "../../types/domain";
import { parseUsdCents } from "../wallet/good-dollar-price";
import {
  COMMITMENT_REWARD_LEG_VERSION,
  type CommitmentMetadataV1,
  type CommitmentRewardLegRecord,
  rewardCentsAsSet,
} from "./metadata";
import type { CommitmentReadModel } from "./types-core";

/** How a part is paid: through Celo settlement from the garden's Safe, or from the steward's wallet. */
export type RewardLegRail = "celo-settlement" | "steward-wallet";

export interface RewardLeg {
  rail: RewardLegRail;
  chainId: number;
  token: Address;
  symbol: string;
  decimals: number;
  /** What the whole reward carries in this token, in base units. */
  amount: bigint;
  /**
   * The dollars this part was set as at Create. Null for a G$ part set in G$,
   * or whose amount an Edit Reward has since changed.
   */
  usdCentsAsSet: bigint | null;
}

export interface PromiseRewardLegs {
  /** The G$ part first, then the declared parts in the order they were set. */
  legs: RewardLeg[];
  /** Part of the reward is declared in a form or token this build can't show. */
  incomplete: boolean;
}

type RewardRecord = Pick<
  CommitmentReadModel,
  "chainId" | "considerationRail" | "considerationAmount"
>;
type RewardMetadata =
  | Pick<CommitmentMetadataV1, "reward" | "rewardLegs" | "rewardLegsUnreadable">
  | null
  | undefined;

/** The G$ part, when the promise's consideration is paid through Celo settlement. */
function goodDollarLegOf(commitment: RewardRecord, metadata: RewardMetadata): RewardLeg | null {
  const amount = commitment.considerationAmount ?? 0n;
  if (commitment.considerationRail !== "CELO_SETTLEMENT" || amount <= 0n) return null;
  return {
    rail: "celo-settlement",
    chainId: CELO_G_DOLLAR_TOKEN.chainId,
    token: CELO_G_DOLLAR_TOKEN.address,
    symbol: CELO_G_DOLLAR_TOKEN.symbol,
    decimals: CELO_G_DOLLAR_TOKEN.decimals,
    amount,
    usdCentsAsSet: rewardCentsAsSet(metadata, amount),
  };
}

/**
 * A token a steward may pay a part in: one the registry lists on that chain, and
 * not G$, whose transfer fee would leave the gardener short of the declared amount.
 */
function stewardWalletRewardToken(chainId: number, token: string) {
  const address = token.toLowerCase();
  return (
    getStablecoinSendableTokens(chainId).find(
      (entry) => entry.supported && entry.symbol !== "G$" && entry.address.toLowerCase() === address
    ) ?? null
  );
}

/**
 * Whether a declared part's amount is exactly the dollars it says it stands for,
 * in a stable token the registry lists on its chain (6 decimals for USDC: $5.00 is
 * 5,000,000). A part whose amount and dollars disagree can't be shown or paid truthfully.
 */
export function rewardLegAmountMatchesDollars(
  leg: Pick<CommitmentRewardLegRecord, "chainId" | "token" | "amount" | "usdCents">
): boolean {
  const token = stewardWalletRewardToken(leg.chainId, leg.token);
  if (!token || token.decimals < 2) return false;
  return BigInt(leg.amount) === BigInt(leg.usdCents) * 10n ** BigInt(token.decimals - 2);
}

/**
 * A promise's reward as its parts, or null when it carries none. A declared part
 * is shown only as the app declares one: beside a G$ part, whose payout plan
 * splits it, with the G$ part's dollars as set, on the promise's chain, in a
 * listed stable token, its amount exactly those dollars. A part left without its
 * G$ part, as when an Edit Reward removes it, can never be split or paid.
 */
export function promiseRewardLegsOf(
  commitment: RewardRecord,
  metadata: RewardMetadata
): PromiseRewardLegs | null {
  const legs: RewardLeg[] = [];
  const goodDollar = goodDollarLegOf(commitment, metadata);
  if (goodDollar) legs.push(goodDollar);
  let incomplete = metadata?.rewardLegsUnreadable === true;
  for (const declared of metadata?.rewardLegs ?? []) {
    const token = stewardWalletRewardToken(declared.chainId, declared.token);
    if (
      !token ||
      !rewardLegAmountMatchesDollars(declared) ||
      goodDollar === null ||
      declared.usdCents !== metadata?.reward?.usdCents ||
      declared.chainId !== commitment.chainId
    ) {
      incomplete = true;
      continue;
    }
    legs.push({
      rail: "steward-wallet",
      chainId: declared.chainId,
      token: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      amount: BigInt(declared.amount),
      usdCentsAsSet: BigInt(declared.usdCents),
    });
  }
  if (legs.length === 0 && !incomplete) return null;
  return { legs, incomplete };
}

/**
 * The reward's dollars as set, when every part was set in dollars; null when any
 * part reads only in its token, so a total never mixes set and estimated dollars.
 */
export function rewardCentsAsSetTotal(reward: Pick<PromiseRewardLegs, "legs">): bigint | null {
  let total = 0n;
  for (const leg of reward.legs) {
    if (leg.usdCentsAsSet === null) return null;
    total += leg.usdCentsAsSet;
  }
  return reward.legs.length > 0 ? total : null;
}

/** USDC on a chain, as the registry lists it; null where the app has none to pay in. */
export function rewardUsdcToken(chainId: number) {
  return (
    getStablecoinSendableTokens(chainId).find(
      (entry) => entry.supported && entry.symbol === "USDC"
    ) ?? null
  );
}

/**
 * The USDC part a seeding answer declares: the same dollars as its G$ part, in
 * USDC on the promise's chain, paid from the steward's wallet once it's kept.
 * The two parts are balanced 1:1 in dollars at the G$ price read at Create.
 * Undefined when the answer asks for no match, has no G$ part set in dollars, or
 * the chain has no USDC to pay in.
 */
export function matchedUsdcLegs(
  values: Pick<
    CommitmentComposerValues,
    "considerationRail" | "considerationUsd" | "rewardMatchedUsdc"
  >,
  chainId: number
): CommitmentRewardLegRecord[] | undefined {
  if (!values.rewardMatchedUsdc || values.considerationRail !== "CELO_SETTLEMENT") return undefined;
  const cents =
    values.considerationUsd === undefined ? null : parseUsdCents(values.considerationUsd);
  const token = rewardUsdcToken(chainId);
  if (cents === null || cents <= 0n || !token || token.decimals < 2) return undefined;
  return [
    {
      version: COMMITMENT_REWARD_LEG_VERSION,
      chainId,
      token: token.address.toLowerCase(),
      amount: (cents * 10n ** BigInt(token.decimals - 2)).toString(),
      usdCents: cents.toString(),
    },
  ];
}
