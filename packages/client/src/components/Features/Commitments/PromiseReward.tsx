import { FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { promiseRewardLegsOf, type RewardLeg } from "@green-goods/shared/commitment-pooling";
import { displayBucketOf } from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type { CommitmentMetadataV1 } from "@green-goods/shared/modules/commitment-pooling/metadata";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import {
  type GoodDollarPriceState,
  goodDollarWeiToUsdCents,
} from "@green-goods/shared/modules/wallet/good-dollar-price";
import { formatUsdCents } from "@green-goods/shared/utils/blockchain/price-feeds";
import { formatTokenAmount } from "@green-goods/shared/utils/blockchain/vaults";
import { RiCoinsLine } from "@remixicon/react";
import { type IntlShape, useIntl } from "react-intl";

/** A reward as one promise's record holds it: its G$ part, and any part paid from the steward's wallet. */
export interface PromiseReward {
  /** The G$ amount, in base units; zero when the reward has no G$ part. */
  wei: bigint;
  /** The dollars the G$ part was set in, while the chain still holds that G$ amount. */
  centsAsSet: bigint | null;
  /** The parts paid in other tokens from the steward's wallet, each with the dollars it was set as. */
  others?: RewardLeg[];
  /** Part of the reward is declared in a form this build can't show. */
  incomplete?: true;
}

/**
 * Where a reward's payout stands: due once the promise is kept, kept with the
 * payout still to come, or paid. "unstated" gives the amount alone.
 */
type RewardPayout = "afterKept" | "notPaidYet" | "paid" | "unstated";

type RewardRecord = Pick<CommitmentReadModel, "considerationRail" | "considerationAmount">;
type RewardMetadata =
  | Pick<CommitmentMetadataV1, "reward" | "rewardLegs" | "rewardLegsUnreadable">
  | null
  | undefined;

const WEI_PER_GOOD_DOLLAR = 10n ** 18n;

/**
 * A promise's reward, or null when it carries none: its G$ part paid through
 * settlement, and the parts declared at Create to be paid from the steward's
 * wallet. An external payout record on its own is not shown here.
 */
export function promiseRewardOf(
  commitment: RewardRecord,
  metadata: RewardMetadata
): PromiseReward | null {
  const read = promiseRewardLegsOf(commitment, metadata);
  if (!read) return null;
  const goodDollar = read.legs.find((leg) => leg.rail === "celo-settlement");
  const others = read.legs.filter((leg) => leg.rail === "steward-wallet");
  return {
    wei: goodDollar?.amount ?? 0n,
    centsAsSet: goodDollar?.usdCentsAsSet ?? null,
    ...(others.length > 0 ? { others } : {}),
    ...(read.incomplete ? { incomplete: true as const } : {}),
  };
}

/** One reward's identity among a group's copies: the same amount in every part. */
function rewardKey(reward: PromiseReward): string {
  return [reward.wei, ...(reward.others ?? []).map((leg) => `${leg.token}:${leg.amount}`)].join(
    "|"
  );
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
  const byKey = new Map<string, PromiseReward>();
  for (const copy of available.length > 0 ? available : copies) {
    const reward = promiseRewardOf(copy, metadata);
    if (reward && !byKey.has(rewardKey(reward))) byKey.set(rewardKey(reward), reward);
  }
  return { rewards: [...byKey.values()], open: available.length > 0 };
}

const ascending = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

/** Whether the G$ part reads in dollars only at today's G$ price. */
function goodDollarsNeedPrice(reward: PromiseReward): boolean {
  return reward.wei > 0n && reward.centsAsSet === null;
}

/**
 * The dollars a reward reads in, or null where its G$ part can read only in G$.
 * The other parts carry the dollars they were set as.
 */
function shownCents(reward: PromiseReward, price: GoodDollarPriceState): bigint | null {
  const goodDollarCents =
    reward.wei === 0n
      ? 0n
      : (reward.centsAsSet ??
        (price.status === "ready" ? goodDollarWeiToUsdCents(reward.wei, price.price) : null));
  if (goodDollarCents === null) return null;
  return (reward.others ?? []).reduce(
    (total, leg) => total + (leg.usdCentsAsSet ?? 0n),
    goodDollarCents
  );
}

/** Whether any of these rewards reads in dollars only at today's G$ price. */
export function rewardsNeedPrice(rewards: readonly PromiseReward[]): boolean {
  return rewards.some(goodDollarsNeedPrice);
}

type RewardIntl = Pick<IntlShape, "formatMessage" | "locale">;

/**
 * The steward console's rule for the same reward: the dollars it was set in,
 * then about today's rate once the G$ amount has changed.
 */
function dollarsText(intl: RewardIntl, reward: PromiseReward, cents: bigint): string {
  const dollars = formatUsdCents(cents, intl.locale);
  return goodDollarsNeedPrice(reward)
    ? intl.formatMessage({ id: "app.commitment.reward.about" }, { amount: dollars })
    : dollars;
}

/** The reward in its tokens, when its dollars can't be read: "160,000 G$ and 5 USDC". */
function tokensAmountText(intl: RewardIntl, reward: PromiseReward): string {
  const parts: string[] = [];
  if (reward.wei > 0n) {
    parts.push(
      intl.formatMessage(
        { id: "app.commitment.reward.goodDollars" },
        {
          amount: new Intl.NumberFormat(intl.locale, { maximumFractionDigits: 0 }).format(
            Number(reward.wei / WEI_PER_GOOD_DOLLAR)
          ),
        }
      )
    );
  }
  for (const leg of reward.others ?? []) {
    parts.push(
      intl.formatMessage(
        { id: "app.commitment.reward.tokenAmount" },
        { amount: formatTokenAmount(leg.amount, leg.decimals, 2, intl.locale), symbol: leg.symbol }
      )
    );
  }
  return listText(intl, parts);
}

/** "G$", "G$ and USDC": the parts joined as the reader's language joins a list. */
function listText(intl: RewardIntl, parts: readonly string[]): string {
  return new Intl.ListFormat(intl.locale, { style: "long", type: "conjunction" }).format(parts);
}

/** The tokens a reward pays in, in the order its parts are listed. */
function rewardTokens(rewards: readonly PromiseReward[]): string[] {
  const symbols = new Set<string>();
  for (const reward of rewards) {
    if (reward.wei > 0n) symbols.add("G$");
    for (const leg of reward.others ?? []) symbols.add(leg.symbol);
  }
  return [...symbols];
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
  // A reward this build can read no part of has no amount to show.
  const shown = rewards
    .filter((reward) => reward.wei > 0n || (reward.others?.length ?? 0) > 0)
    .map((reward) => ({ reward, cents: shownCents(reward, price) }));
  const inDollars = shown.every(({ cents }) => cents !== null);
  const ranked = [...shown].sort((a, b) =>
    inDollars ? ascending(a.cents ?? 0n, b.cents ?? 0n) : ascending(a.reward.wei, b.reward.wei)
  );
  const low = ranked[0];
  const high = ranked[ranked.length - 1];
  if (!low || !high) return null;
  const textOf = ({ reward, cents }: (typeof shown)[number]) =>
    inDollars && cents !== null ? dollarsText(intl, reward, cents) : tokensAmountText(intl, reward);
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
 * The reward as a member reads it: its amount, the tokens it is paid in and
 * where its payout stands. A member deciding to take a promise up reads what it
 * pays in once kept; a G$-only reward reads as it always has. When part of the
 * reward can't be shown, the line says so rather than pass the rest off as all of it.
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
  const incomplete = rewards.some((reward) => reward.incomplete);
  const line =
    amount === null
      ? null
      : payout === "unstated"
        ? amount
        : intl.formatMessage(
            { id: PAYOUT_MESSAGE_ID[payout] },
            { amount, tokens: listText(intl, rewardTokens(rewards)) }
          );
  if (!incomplete) return line;
  return line === null
    ? intl.formatMessage({ id: "app.commitment.reward.unreadable" })
    : intl.formatMessage({ id: "app.commitment.reward.incomplete" }, { reward: line });
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
