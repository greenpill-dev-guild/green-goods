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

/**
 * Where a reward's payout stands: due once the promise is kept, kept with the
 * payout still to come, or paid. "unstated" gives the amount alone.
 */
type RewardPayout = "afterKept" | "notPaidYet" | "paid" | "unstated";

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

/** Where one promise's payout stands: settlement can pay it only once it is kept. */
export function promisePayoutOf(
  commitment: Pick<CommitmentReadModel, "derivedState" | "considerationPaid">
): RewardPayout {
  if (commitment.considerationPaid === true) return "paid";
  return commitment.derivedState === "FULFILLED" || commitment.derivedState === "RECONCILED"
    ? "notPaidYet"
    : "afterKept";
}

interface GroupRewards {
  rewards: PromiseReward[];
  /** A member can still take up one of the copies. */
  open: boolean;
}

/**
 * The rewards on the copies of a group a member could still take up: one
 * amount, unless an Edit Reward stopped part way. With none left to take up,
 * every copy's, for what each one carried.
 */
export function groupRewardsOf(
  copies: readonly (RewardRecord & Pick<CommitmentReadModel, "onchainState">)[],
  metadata: RewardMetadata
): GroupRewards {
  const available = copies.filter((copy) => displayBucketOf(copy.onchainState) === "available");
  const byWei = new Map<bigint, PromiseReward>();
  for (const copy of available.length > 0 ? available : copies) {
    const reward = promiseRewardOf(copy, metadata);
    if (reward && !byWei.has(reward.wei)) byWei.set(reward.wei, reward);
  }
  return { rewards: [...byWei.values()], open: available.length > 0 };
}

const ascending = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

/** The dollars a reward reads in, or null where it can read only in G$. */
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
 * then about today's rate once the G$ amount has changed.
 */
function dollarsText(intl: RewardIntl, reward: PromiseReward, cents: bigint): string {
  const dollars = formatUsdCents(cents, intl.locale);
  return reward.centsAsSet !== null
    ? dollars
    : intl.formatMessage({ id: "app.commitment.reward.about" }, { amount: dollars });
}

function goodDollarsText(intl: RewardIntl, reward: PromiseReward): string {
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
 * The amount, or a range lowest first. Amounts read in dollars when every one
 * can, ordered by the dollars they show, so dollars set at Create and dollars
 * at today's rate stay in order; otherwise every one reads in G$, so a range
 * never runs from one currency to the other.
 */
function rewardAmountText(
  intl: RewardIntl,
  rewards: readonly PromiseReward[],
  price: GoodDollarPriceState
): string | null {
  const shown = rewards.map((reward) => ({ reward, cents: shownCents(reward, price) }));
  const inDollars = shown.every(({ cents }) => cents !== null);
  const ranked = [...shown].sort((a, b) =>
    inDollars ? ascending(a.cents ?? 0n, b.cents ?? 0n) : ascending(a.reward.wei, b.reward.wei)
  );
  const low = ranked[0];
  const high = ranked[ranked.length - 1];
  if (!low || !high) return null;
  const textOf = ({ reward, cents }: (typeof shown)[number]) =>
    inDollars && cents !== null ? dollarsText(intl, reward, cents) : goodDollarsText(intl, reward);
  const lowText = textOf(low);
  const highText = textOf(high);
  return lowText === highText
    ? lowText
    : intl.formatMessage({ id: "app.commitment.reward.range" }, { low: lowText, high: highText });
}

const PAYOUT_MESSAGE_ID = {
  afterKept: "app.commitment.reward.afterKept",
  notPaidYet: "app.commitment.reward.notPaidYet",
  paid: "app.commitment.reward.paid",
} as const;

/**
 * The reward as a member reads it: its amount, and where its payout stands. A
 * member deciding to take a promise up reads that it is paid in G$ once kept.
 */
export function promiseRewardText(input: {
  intl: RewardIntl;
  rewards: readonly PromiseReward[];
  price: GoodDollarPriceState;
  /** Where the payout stands; a promise still to be kept unless said. */
  payout?: RewardPayout;
}): string | null {
  const { intl, rewards, price, payout = "afterKept" } = input;
  const amount = rewardAmountText(intl, rewards, price);
  if (amount === null || payout === "unstated") return amount;
  return intl.formatMessage({ id: PAYOUT_MESSAGE_ID[payout] }, { amount });
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
