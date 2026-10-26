import { FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { SETTLEMENT_ENABLED } from "@green-goods/shared/config/app";
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
 * The rewards on the copies of a group a member could still take up, lowest
 * first: one amount, unless an Edit Reward stopped part way. With none left to
 * take up, the first copy's, for what each one carried.
 */
export function groupRewardsOf(
  copies: readonly (RewardRecord & Pick<CommitmentReadModel, "onchainState">)[],
  metadata: RewardMetadata
): PromiseReward[] {
  const available = copies.filter((copy) => displayBucketOf(copy.onchainState) === "available");
  const byWei = new Map<bigint, PromiseReward>();
  for (const copy of available.length > 0 ? available : copies.slice(0, 1)) {
    const reward = promiseRewardOf(copy, metadata);
    if (reward && !byWei.has(reward.wei)) byWei.set(reward.wei, reward);
  }
  return [...byWei.values()].sort((a, b) => (a.wei < b.wei ? -1 : a.wei > b.wei ? 1 : 0));
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
 * that it is paid in G$ once the promise is kept. While payouts are switched
 * off in this app, it says so instead of promising a payment.
 */
export function promiseRewardText(input: {
  intl: RewardIntl;
  rewards: readonly PromiseReward[];
  price: GoodDollarPriceState;
  /** The reward on this promise has been paid. */
  paid?: boolean;
  payoutsOn?: boolean;
}): string | null {
  const { intl, rewards, price, paid = false, payoutsOn = SETTLEMENT_ENABLED } = input;
  const low = rewards[0];
  const high = rewards[rewards.length - 1];
  if (!low || !high) return null;
  const amount =
    low === high
      ? amountText(intl, low, price)
      : intl.formatMessage(
          { id: "app.commitment.reward.range" },
          { low: amountText(intl, low, price), high: amountText(intl, high, price) }
        );
  return intl.formatMessage(
    {
      id: paid
        ? "app.commitment.reward.paid"
        : payoutsOn
          ? "app.commitment.reward.afterKept"
          : "app.commitment.reward.payoutsOff",
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
