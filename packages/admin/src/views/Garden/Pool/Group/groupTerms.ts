/**
 * A group's shared terms, as its inspector and Add to This Group show them:
 * what each promise asks for, when it is due, its reward and how it is taken
 * up. Rewards read in the dollars they were set in while the chain still holds
 * that G$ amount, and at today's rate, marked "about", after that (decision 15).
 */

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
import type { IntlShape } from "react-intl";
import { railLabel } from "../CommitmentDialog/commitmentDialogPresentation";
import { formatGoodDollars, formatUsd } from "../poolPresentation";
import { dayText, exactTime } from "../poolTime";

type TermsIntl = Pick<IntlShape, "formatMessage" | "formatDate" | "locale">;

export interface GroupReward {
  /** The G$ amount on a copy nobody has taken: what new copies take and Edit Reward changes. */
  currentWei: bigint | null;
  /** Its dollars as they were set, while the chain still holds that amount. */
  centsAsSet: bigint | null;
}

const isGoodDollarReward = (commitment: CommitmentReadModel) =>
  commitment.considerationRail === "CELO_SETTLEMENT" && (commitment.considerationAmount ?? 0n) > 0n;

/** The group's reward now, from a copy nobody has taken, or any copy when none is left. */
export function groupReward(
  children: readonly CommitmentReadModel[],
  metadata: CommitmentMetadataV1 | null
): GroupReward {
  const source =
    children.find((child) => displayBucketOf(child.onchainState) === "available") ?? children[0];
  if (!source || !isGoodDollarReward(source)) return { currentWei: null, centsAsSet: null };
  const currentWei = source.considerationAmount ?? null;
  return { currentWei, centsAsSet: rewardCentsAsSet(metadata, currentWei) };
}

/** A G$ amount in dollars: as set, else about today's rate, else in G$. */
function rewardText(
  intl: TermsIntl,
  wei: bigint,
  centsAsSet: bigint | null,
  price: GoodDollarPriceState
): string {
  if (centsAsSet !== null) return formatUsd(centsAsSet, intl.locale);
  if (price.status === "ready") {
    return intl.formatMessage(
      { id: "cockpit.garden.pool.reward.about", defaultMessage: "about {amount}" },
      { amount: formatUsd(goodDollarWeiToUsdCents(wei, price.price), intl.locale) }
    );
  }
  return intl.formatMessage(
    { id: "cockpit.garden.pool.reward.inGoodDollars", defaultMessage: "{amount} G$" },
    { amount: formatGoodDollars(wei, intl.locale) }
  );
}

/**
 * "$5.00 each in G$, paid once it's kept (38,866 G$, set Sep 28)", or how it
 * differs after Edit Reward. The day shows only while the reward is still the
 * one set in dollars at creation and the activity window reaches that day.
 */
function rewardLine(
  intl: TermsIntl,
  children: readonly CommitmentReadModel[],
  reward: GroupReward,
  metadata: CommitmentMetadataV1 | null,
  price: GoodDollarPriceState,
  set: { at: number | null; now: number }
): string {
  const [first] = children;
  if (!first || reward.currentWei === null) {
    return railLabel(first?.considerationRail ?? null, intl.formatMessage);
  }
  const current = rewardText(intl, reward.currentWei, reward.centsAsSet, price);
  const goodDollars = formatGoodDollars(reward.currentWei, intl.locale);
  const takenAtOther = children.filter(
    (child) =>
      displayBucketOf(child.onchainState) !== "available" &&
      child.considerationAmount !== reward.currentWei &&
      (child.considerationAmount ?? 0n) > 0n
  );
  const earlier = takenAtOther[0]?.considerationAmount;
  if (!earlier && reward.centsAsSet !== null && set.at !== null) {
    return intl.formatMessage(
      {
        id: "cockpit.garden.pool.group.rewardEachSet",
        defaultMessage: "{amount} each in G$, paid once it’s kept ({goodDollars} G$, set {day})",
      },
      { amount: current, goodDollars, day: dayText(intl, set.at, set.now) }
    );
  }
  if (!earlier) {
    return intl.formatMessage(
      {
        id: "cockpit.garden.pool.group.rewardEach",
        defaultMessage: "{amount} each in G$, paid once it’s kept ({goodDollars} G$)",
      },
      { amount: current, goodDollars }
    );
  }
  return intl.formatMessage(
    {
      id: "cockpit.garden.pool.group.rewardChanged",
      defaultMessage:
        "{amount} each in G$ for the {available} available ({goodDollars} G$) · {taken} taken at {earlier}",
    },
    {
      amount: current,
      goodDollars,
      available: children.filter((child) => displayBucketOf(child.onchainState) === "available")
        .length,
      taken: takenAtOther.length,
      earlier: rewardText(intl, earlier, rewardCentsAsSet(metadata, earlier), price),
    }
  );
}

/** The group's terms as label and value: the inspector's "Each promise" and "Same as the group". */
export function groupTerms(input: {
  intl: TermsIntl;
  children: readonly CommitmentReadModel[];
  metadata: CommitmentMetadataV1 | null;
  reward: GroupReward;
  price: GoodDollarPriceState;
  /** When the group's reward was set (`groupSetAt`), and now, for "set Sep 28". */
  setAt: number | null;
  now: number;
}): Array<[string, string]> {
  const { intl, children, metadata, reward, price, setAt, now } = input;
  const { formatMessage } = intl;
  const [first] = children;
  if (!first) return [];
  const amount = `${first.targetUnits.toString()} ${first.unitLabel ?? ""}`.trim();
  const due = Number(first.dueDate ?? 0n) * 1000;
  return [
    [
      formatMessage({ id: "cockpit.garden.pool.group.asksFor", defaultMessage: "Asks for" }),
      formatMessage(
        {
          id:
            first.direction === "OFFER"
              ? "cockpit.garden.pool.group.poolOffers"
              : "cockpit.garden.pool.group.poolRequests",
          defaultMessage:
            first.direction === "OFFER"
              ? "{amount} · The pool offers"
              : "{amount} · The pool requests",
        },
        { amount }
      ),
    ],
    [
      formatMessage({ id: "cockpit.garden.pool.commitment.fact.due", defaultMessage: "Due" }),
      due > 0 ? exactTime(intl, due) : "—",
    ],
    [
      formatMessage({ id: "cockpit.garden.pool.group.reward", defaultMessage: "Reward" }),
      rewardLine(intl, children, reward, metadata, price, { at: setAt, now }),
    ],
    [
      formatMessage({
        id: "cockpit.garden.pool.group.claimAndConfirmers",
        defaultMessage: "Claim mode · confirmers",
      }),
      `${
        first.claimMode === "APPROVAL_GATED"
          ? formatMessage({
              id: "cockpit.garden.pool.seed.claimMode.gated",
              defaultMessage: "Steward-reviewed",
            })
          : formatMessage({ id: "cockpit.garden.pool.seed.claimMode.open", defaultMessage: "Open" })
      } · ${
        first.confirmers.length === 0
          ? formatMessage({
              id: "cockpit.garden.pool.seed.review.ordinary",
              defaultMessage: "Ordinary rule",
            })
          : formatMessage(
              {
                id: "cockpit.garden.pool.seed.review.named",
                defaultMessage: "Named group · {threshold} of {count}",
              },
              { threshold: first.confirmationThreshold ?? 1, count: first.confirmers.length }
            )
      }`,
    ],
  ];
}
