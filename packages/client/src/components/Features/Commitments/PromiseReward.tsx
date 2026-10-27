import { FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { displayBucketOf } from "@green-goods/shared/modules/commitment-pooling/display-groups";
import {
  type CommitmentMetadataV1,
  rewardCentsAsSet,
} from "@green-goods/shared/modules/commitment-pooling/metadata";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import {
  type GoodDollarPriceState,
  goodDollarWeiToUsdCents,
} from "@green-goods/shared/modules/wallet/good-dollar-price";
import { formatUsdCents } from "@green-goods/shared/utils/blockchain/price-feeds";
import { RiCoinsLine } from "@remixicon/react";
import { type IntlShape, useIntl } from "react-intl";

/** A G$ reward as one promise's record holds it. */
export interface PromiseReward {
  /** The G$ amount, in base units. */
  wei: bigint;
  /** The dollars it was set in, while the chain still holds that G$ amount. */
  centsAsSet: bigint | null;
}

type RewardRecord = Pick<CommitmentReadModel, "considerationRail" | "considerationAmount">;
type RewardMetadata = Pick<CommitmentMetadataV1, "reward"> | null | undefined;

const WEI_PER_GOOD_DOLLAR = 10n ** 18n;

/**
 * A promise's G$ reward, or null when it carries none. Only the G$ rail is
 * paid through the app; an external payout record is not shown here.
 */
export function promiseRewardOf(
  commitment: RewardRecord,
  metadata: RewardMetadata
): PromiseReward | null {
  const wei = commitment.considerationAmount ?? 0n;
  if (commitment.considerationRail !== "CELO_SETTLEMENT" || wei <= 0n) return null;
  return { wei, centsAsSet: rewardCentsAsSet(metadata, wei) };
}

/**
 * The rewards on the copies of a group a member could still take up: one
 * amount, unless an Edit Reward stopped part way. With none left to take up,
 * every copy's, for what each one carried.
 */
export function groupRewardsOf(
  copies: readonly (RewardRecord & Pick<CommitmentReadModel, "onchainState">)[],
  metadata: RewardMetadata
): PromiseReward[] {
  const available = copies.filter((copy) => displayBucketOf(copy.onchainState) === "available");
  const byWei = new Map<bigint, PromiseReward>();
  for (const copy of available.length > 0 ? available : copies) {
    const reward = promiseRewardOf(copy, metadata);
    if (reward && !byWei.has(reward.wei)) byWei.set(reward.wei, reward);
  }
  return [...byWei.values()];
}

const ascending = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

/** The dollars a reward reads in, or null where it reads in G$. */
function shownCents(reward: PromiseReward, price: GoodDollarPriceState): bigint | null {
  if (reward.centsAsSet !== null) return reward.centsAsSet;
  return price.status === "ready" ? goodDollarWeiToUsdCents(reward.wei, price.price) : null;
}

/** Whether any of these rewards reads in dollars only at today's G$ price. */
export function rewardsNeedPrice(rewards: readonly PromiseReward[]): boolean {
  return rewards.some((reward) => reward.centsAsSet === null);
}

type RewardIntl = Pick<IntlShape, "formatMessage" | "locale">;

/**
 * The steward console's rule for the same reward: the dollars it was set in,
 * then about today's rate once the G$ amount has changed, else the G$ amount.
 */
function amountText(intl: RewardIntl, reward: PromiseReward, price: GoodDollarPriceState): string {
  if (reward.centsAsSet !== null) return formatUsdCents(reward.centsAsSet, intl.locale);
  if (price.status === "ready") {
    return intl.formatMessage(
      { id: "app.commitment.reward.about" },
      { amount: formatUsdCents(goodDollarWeiToUsdCents(reward.wei, price.price), intl.locale) }
    );
  }
  return intl.formatMessage(
    { id: "app.commitment.reward.goodDollars" },
    {
      amount: new Intl.NumberFormat(intl.locale, { maximumFractionDigits: 0 }).format(
        Number(reward.wei / WEI_PER_GOOD_DOLLAR)
      ),
    }
  );
}

/**
 * The reward as a member reads it before taking a promise up: its amount, and
 * that it is paid in G$ once the promise is kept; once kept, whether it has
 * been paid yet. Several amounts read as a range, lowest first by what they
 * show, so dollars set at Create and dollars at today's rate stay in order.
 */
export function promiseRewardText(input: {
  intl: RewardIntl;
  rewards: readonly PromiseReward[];
  price: GoodDollarPriceState;
  /** The promise has been kept. */
  kept?: boolean;
  /** The reward on this promise has been paid. */
  paid?: boolean;
}): string | null {
  const { intl, rewards, price, kept = false, paid = false } = input;
  const cents = rewards.map((reward) => shownCents(reward, price));
  const ranked = cents.every((value) => value !== null)
    ? rewards
        .map((reward, index) => ({ reward, value: cents[index] as bigint }))
        .sort((a, b) => ascending(a.value, b.value))
        .map(({ reward }) => reward)
    : [...rewards].sort((a, b) => ascending(a.wei, b.wei));
  const low = ranked[0];
  const high = ranked[ranked.length - 1];
  if (!low || !high) return null;
  const lowText = amountText(intl, low, price);
  const highText = amountText(intl, high, price);
  const amount =
    lowText === highText
      ? lowText
      : intl.formatMessage({ id: "app.commitment.reward.range" }, { low: lowText, high: highText });
  return intl.formatMessage(
    {
      id: paid
        ? "app.commitment.reward.paid"
        : kept
          ? "app.commitment.reward.notPaidYet"
          : "app.commitment.reward.afterKept",
    },
    { amount }
  );
}

/** The reward among a promise's terms. */
export function PromiseRewardRow({ text }: { text: string }) {
  const { formatMessage } = useIntl();
  return (
    <FactRow
      data-component="PromiseReward"
      icon={<RiCoinsLine />}
      label={formatMessage({ id: "app.commitment.reward.label" })}
      value={text}
    />
  );
}
