/**
 * A seeding answer's reward as the steward reads it: dollars first, the G$
 * amount beside (PRD-1022 D13). The G$ amount is converted from the dollars
 * at Create and fixed from then, so before Create it is an estimate at today's
 * rate. One module, so the Proof step, the Review and Create agree on what a
 * typed amount means.
 */

import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import {
  type GoodDollarPriceState,
  goodDollarWeiToUsdCents,
  parseUsdCents,
  usdCentsText,
  usdCentsToGoodDollarWei,
} from "@green-goods/shared/modules/wallet/good-dollar-price";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

const WEI_PER_G = 10n ** 18n;
const SECONDS_PER_DAY = 86_400;

/** Cents as dollars, the way the steward's locale writes money. */
export function formatUsd(cents: bigint, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(
    Number(cents) / 100
  );
}

/** A G$ amount in whole G$, grouped the way the steward's locale groups numbers. */
export function formatGoodDollars(wei: bigint, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Number(wei / WEI_PER_G)
  );
}

/** The dollars an answer's reward was typed in, when it was typed in dollars. */
export function rewardCentsOf(
  values: Pick<CommitmentComposerValues, "considerationRail" | "considerationUsd">
): bigint | null {
  if (values.considerationRail !== "CELO_SETTLEMENT" || values.considerationUsd === undefined) {
    return null;
  }
  return parseUsdCents(values.considerationUsd);
}

/**
 * The G$ base units one copy is created with, fixed at Create from the dollars
 * at the price read for it. An amount carried over in G$ (seeding more like an
 * earlier promise) is kept as it was. Empty when there is no reward.
 */
export function rewardAmountAtCreate(
  values: Pick<
    CommitmentComposerValues,
    "considerationRail" | "considerationUsd" | "considerationAmount"
  >,
  price: bigint | null
): string {
  if (values.considerationRail === "NONE") return "";
  const cents = rewardCentsOf(values);
  if (cents === null) return values.considerationAmount;
  if (price === null) throw new Error("A dollar reward needs today's G$ price to be created");
  return usdCentsToGoodDollarWei(cents, price).toString();
}

/**
 * An earlier promise's answers, minus a reward recorded as an external payout:
 * seeding pays in G$ only now (PRD-1022 D9), so such a reward is asked again.
 */
export function withoutExternalReward(
  values: Partial<CommitmentComposerValues> | null
): Partial<CommitmentComposerValues> {
  if (!values) return {};
  if (values.considerationRail !== "ARBITRUM_EXTERNAL") return values;
  return {
    ...values,
    considerationRail: "NONE",
    considerationAmount: "",
    considerationSource: "",
    considerationToken: "",
  };
}

/** Whether any of these answers needs today's G$ price to be created. */
export function needsGoodDollarPrice(rows: readonly CommitmentComposerValues[]): boolean {
  return rows.some((row) => rewardCentsOf(row) !== null);
}

/** Dollars for a G$ amount carried over from an earlier promise, at today's rate. */
export function carriedOverUsd(considerationAmount: string, price: bigint): string {
  const wei = /^\d+$/.test(considerationAmount) ? BigInt(considerationAmount) : 0n;
  return usdCentsText(goodDollarWeiToUsdCents(wei, price));
}

/** When a promise answered now is due, for the review; Create fixes the exact second. */
export function dueDateAfter(now: number, dueInDays: number): Date {
  return new Date(now + dueInDays * SECONDS_PER_DAY * 1000);
}

/** A deadline in full, with its time zone, since every copy shares it to the second. */
export function formatDueDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/** Why a dollar amount can't be converted right now, or null when it can. */
export function priceUnavailableReason(
  price: GoodDollarPriceState,
  formatMessage: FormatMessage
): string | null {
  if (price.status === "ready") return null;
  if (price.status === "loading") {
    return formatMessage({
      id: "cockpit.garden.pool.seed.price.loading",
      defaultMessage: "Reading today's G$ price…",
    });
  }
  switch (price.reason) {
    case "paused":
      return formatMessage({
        id: "cockpit.garden.pool.seed.price.paused",
        defaultMessage:
          "GoodDollar's reserve is paused, so dollars can't be turned into G$ right now.",
      });
    case "stale":
      return formatMessage({
        id: "cockpit.garden.pool.seed.price.stale",
        defaultMessage:
          "Today's G$ price is out of date, so dollars can't be turned into G$. Try again in a minute.",
      });
    default:
      return formatMessage({
        id: "cockpit.garden.pool.seed.price.missing",
        defaultMessage:
          "Today's G$ price can't be read, so dollars can't be turned into G$. Try again in a minute.",
      });
  }
}

/** The Review's Reward rows: each copy in dollars, its G$ beside, and the most it could total. */
export function rewardFacts(input: {
  values: CommitmentComposerValues;
  count: number;
  price: GoodDollarPriceState;
  locale: string;
  formatMessage: FormatMessage;
}): Array<[string, string]> {
  const { values, count, price, locale, formatMessage } = input;
  if (values.considerationRail === "NONE") {
    return [
      [
        formatMessage({ id: "cockpit.garden.pool.seed.review.rewardEach", defaultMessage: "Each" }),
        formatMessage({ id: "cockpit.garden.pool.seed.rail.none", defaultMessage: "None" }),
      ],
    ];
  }
  const cents = rewardCentsOf(values);
  if (cents === null) {
    const wei = /^\d+$/.test(values.considerationAmount) ? BigInt(values.considerationAmount) : 0n;
    return [
      [
        formatMessage({ id: "cockpit.garden.pool.seed.review.rewardEach", defaultMessage: "Each" }),
        formatMessage(
          {
            id: "cockpit.garden.pool.seed.review.rewardGoodDollars",
            defaultMessage: "{amount} G$, paid once it's kept",
          },
          { amount: formatGoodDollars(wei, locale) }
        ),
      ],
    ];
  }
  const rows: Array<[string, string]> = [
    [
      formatMessage({ id: "cockpit.garden.pool.seed.review.rewardEach", defaultMessage: "Each" }),
      formatMessage(
        {
          id: "cockpit.garden.pool.seed.review.rewardDollars",
          defaultMessage: "{amount}, paid in G$ once it's kept",
        },
        { amount: formatUsd(cents, locale) }
      ),
    ],
    [
      formatMessage({
        id: "cockpit.garden.pool.seed.review.rewardInGoodDollars",
        defaultMessage: "In G$",
      }),
      price.status === "ready"
        ? formatMessage(
            {
              id: "cockpit.garden.pool.seed.review.rewardAbout",
              defaultMessage: "About {amount} G$ each, fixed when you create",
            },
            { amount: formatGoodDollars(usdCentsToGoodDollarWei(cents, price.price), locale) }
          )
        : formatMessage({
            id: "cockpit.garden.pool.seed.review.rewardAtCreate",
            defaultMessage: "Converted at today's rate when you create",
          }),
    ],
  ];
  if (count > 1) {
    rows.push([
      formatMessage(
        {
          id: "cockpit.garden.pool.seed.review.rewardAllKept",
          defaultMessage: "If all {count} are kept",
        },
        { count }
      ),
      formatMessage(
        { id: "cockpit.garden.pool.seed.review.rewardUpTo", defaultMessage: "Up to {amount}" },
        { amount: formatUsd(cents * BigInt(count), locale) }
      ),
    ]);
  }
  return rows;
}
