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

type TermsIntl = Pick<IntlShape, "formatMessage" | "formatDate" | "formatDateToParts" | "locale">;

export interface GroupReward {
  /** The G$ amount on a copy nobody has taken: what new copies take and Edit Reward changes. */
  currentWei: bigint | null;
  /** Each untaken copy's current reward, which may differ after a partial edit. */
  available: readonly { wei: bigint | null; centsAsSet: bigint | null }[];
  /** Each taken child's immutable agreement, including distinct earlier edits. */
  taken: readonly { wei: bigint | null; centsAsSet: bigint | null }[];
  /** Its dollars as they were set, while the chain still holds that amount. */
  centsAsSet: bigint | null;
}

const isGoodDollarReward = (commitment: CommitmentReadModel) =>
  commitment.considerationRail === "CELO_SETTLEMENT" && (commitment.considerationAmount ?? 0n) > 0n;

/** The group's reward now, from a copy nobody has taken, or any copy when none is left. */
export function groupReward(
  children: readonly CommitmentReadModel[],
  metadataByCID: ReadonlyMap<string, CommitmentMetadataV1>
): GroupReward {
  const source =
    children.find((child) => displayBucketOf(child.onchainState) === "available") ?? children[0];
  const metadataOf = (child: CommitmentReadModel) =>
    child.metadataCID ? metadataByCID.get(child.metadataCID.trim()) : null;
  const agreementOf = (child: CommitmentReadModel) => ({
    wei: child.considerationAmount ?? null,
    centsAsSet: rewardCentsAsSet(metadataOf(child), child.considerationAmount),
  });
  const available = children
    .filter((child) => displayBucketOf(child.onchainState) === "available")
    .map(agreementOf);
  const taken = children
    .filter((child) => {
      const bucket = displayBucketOf(child.onchainState);
      return bucket === "inProgress" || bucket === "kept";
    })
    .map(agreementOf);
  if (!source || !isGoodDollarReward(source))
    return { currentWei: null, centsAsSet: null, available, taken };
  const currentWei = source.considerationAmount ?? null;
  return {
    currentWei,
    centsAsSet: rewardCentsAsSet(metadataOf(source), currentWei),
    available,
    taken,
  };
}

/** A G$ amount in dollars: as set, else about today's rate, else in G$. */
export function rewardText(
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
  price: GoodDollarPriceState,
  set: { at: number | null; now: number }
): string {
  const [first] = children;
  if (!first || reward.currentWei === null) {
    return railLabel(first?.considerationRail ?? null, intl.formatMessage);
  }
  const current = rewardText(intl, reward.currentWei, reward.centsAsSet, price);
  const goodDollars = formatGoodDollars(reward.currentWei, intl.locale);
  const labelOf = (agreement: GroupReward["available"][number]) =>
    agreement.wei === null ? "—" : rewardText(intl, agreement.wei, agreement.centsAsSet, price);
  const amountsOf = (agreements: GroupReward["available"]) => {
    const amounts = new Map<string, number>();
    for (const agreement of agreements) {
      const label = labelOf(agreement);
      amounts.set(label, (amounts.get(label) ?? 0) + 1);
    }
    return [...amounts].map(([label, count]) => `${count} × ${label}`).join(" · ");
  };
  const mixedAvailable = reward.available.some((agreement) => labelOf(agreement) !== current);
  const mixed = mixedAvailable || reward.taken.some((agreement) => labelOf(agreement) !== current);
  if (mixedAvailable) {
    const sections = [
      `${intl.formatMessage(
        { id: "cockpit.garden.pool.reward.availableRow", defaultMessage: "{count} available" },
        { count: reward.available.length }
      )}: ${amountsOf(reward.available)}`,
    ];
    if (reward.taken.length > 0) {
      sections.push(
        `${intl.formatMessage(
          { id: "cockpit.garden.pool.reward.takenRow", defaultMessage: "{count} taken" },
          { count: reward.taken.length }
        )}: ${amountsOf(reward.taken)}`
      );
    }
    return sections.join(" · ");
  }
  if (!mixed && reward.centsAsSet !== null && set.at !== null) {
    return intl.formatMessage(
      {
        id: "cockpit.garden.pool.group.rewardEachSet",
        defaultMessage: "{amount} each in G$, paid once it’s kept ({goodDollars} G$, set {day})",
      },
      { amount: current, goodDollars, day: dayText(intl, set.at, set.now) }
    );
  }
  if (!mixed) {
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
      id: "cockpit.garden.pool.group.rewardAgreements",
      defaultMessage: "{available} available at {amount} each in G$ · taken rewards: {taken}",
    },
    {
      amount: current,
      available: reward.available.length,
      taken: amountsOf(reward.taken),
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
  const { intl, children, reward, price, setAt, now } = input;
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
      rewardLine(intl, children, reward, price, { at: setAt, now }),
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
