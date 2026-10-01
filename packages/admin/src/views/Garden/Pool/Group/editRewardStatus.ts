/**
 * What Edit Reward's one summary says (PRD-1022 D14, screens 31–33): ready,
 * the wallet asking, and how a change ended. One function, so the summary, the
 * footer and Try Again never read the same change two ways.
 */

import type { RewardEditProgress } from "@green-goods/shared/hooks/admin-ui/pool/useEditReward";
import type { CreationSendMode } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type { FlowStatusTone } from "@/components/Layout/FlowStatusRow";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

export type EditRewardPhase =
  | "ready"
  | "asking"
  | "confirming"
  | "sending"
  | "declined"
  | "refused"
  | "unconfirmed"
  | "partial"
  | "changed";

export interface EditRewardStatus {
  phase: EditRewardPhase;
  tone: FlowStatusTone;
  busy: boolean;
  title: string;
  description: string;
  /** Only for a wallet asked once per copy. */
  progress: number | null;
  /** The copies Try Again changes: the ones that weren't. */
  retry: readonly bigint[];
}

const IN_FLIGHT = new Set<RewardEditProgress["status"]>(["waiting", "wallet", "confirming"]);

export function editRewardStatus(input: {
  mode: CreationSendMode | null;
  isSending: boolean;
  copies: readonly RewardEditProgress[] | null;
  /** Copies nobody has taken: what this changes. */
  available: number;
  /** Who took theirs, by name: they keep their reward. */
  takenBy: readonly string[];
  formatMessage: FormatMessage;
  formatList: (items: string[]) => string;
}): EditRewardStatus {
  const { mode, isSending, copies, available, takenBy, formatMessage } = input;
  if (!copies) {
    const names =
      takenBy.length <= 3
        ? input.formatList([...takenBy])
        : input.formatList([
            ...takenBy.slice(0, 2),
            formatMessage(
              { id: "cockpit.garden.pool.reward.others", defaultMessage: "{count} others" },
              { count: takenBy.length - 2 }
            ),
          ]);
    return {
      phase: "ready",
      tone: "neutral",
      busy: false,
      progress: null,
      retry: [],
      title: formatMessage(
        {
          id: "cockpit.garden.pool.reward.ready",
          defaultMessage:
            "{count, plural, one {Changes the reward for the one available promise} other {Changes the reward for # available promises}}",
        },
        { count: available }
      ),
      description:
        takenBy.length === 0
          ? formatMessage({
              id: "cockpit.garden.pool.reward.readyNoneTaken",
              defaultMessage: "Nobody has taken one yet, so every one changes.",
            })
          : formatMessage(
              {
                id: "cockpit.garden.pool.reward.readyTakenAgreements",
                defaultMessage:
                  "{count, plural, one {{names} keeps the reward agreed at take-up.} other {{names} keep the rewards agreed at take-up.}}",
              },
              { count: takenBy.length, names }
            ),
    };
  }

  const changed = copies.filter((copy) => copy.status === "changed").length;
  const missed = copies.filter((copy) => copy.status === "not-changed");
  const oneByOne = mode === "one-by-one";
  const progress = oneByOne ? (changed / Math.max(1, copies.length)) * 100 : null;

  if (isSending) {
    const at = Math.max(
      0,
      copies.findIndex((copy) => IN_FLIGHT.has(copy.status))
    );
    if (oneByOne) {
      return {
        phase: "sending",
        tone: "info",
        busy: true,
        progress,
        retry: [],
        title: formatMessage(
          {
            id: "cockpit.garden.pool.reward.sending",
            defaultMessage: "Confirm in your wallet ({current} of {total})",
          },
          { current: at + 1, total: copies.length }
        ),
        description: formatMessage(
          {
            id: "cockpit.garden.pool.reward.sendingHint",
            defaultMessage:
              "{changed} changed so far. This wallet asks once per promise; declining one leaves only that one as it was.",
          },
          { changed }
        ),
      };
    }
    const confirming = copies[at]?.status === "confirming";
    return confirming
      ? {
          phase: "confirming",
          tone: "info",
          busy: true,
          progress: null,
          retry: [],
          title: formatMessage(
            {
              id: "cockpit.garden.pool.reward.confirming",
              defaultMessage:
                "{count, plural, one {Changing the reward} other {Changing # rewards}}",
            },
            { count: copies.length }
          ),
          description: formatMessage({
            id: "cockpit.garden.pool.reward.confirmingHint",
            defaultMessage: "Your wallet approved. Waiting for the chain to confirm.",
          }),
        }
      : {
          phase: "asking",
          tone: "info",
          busy: true,
          progress: null,
          retry: [],
          title: formatMessage(
            {
              id: "cockpit.garden.pool.reward.asking",
              defaultMessage:
                "{count, plural, one {Approve in your wallet} other {Approve in your wallet: # rewards in one request}}",
            },
            { count: copies.length }
          ),
          description: formatMessage(
            {
              id: "cockpit.garden.pool.reward.askingHint",
              defaultMessage:
                "{count, plural, one {It changes once your wallet approves.} other {They change together: all #, or none if the wallet declines.}}",
            },
            { count: copies.length }
          ),
        };
  }

  const retry = missed.map((copy) => copy.commitmentId);
  if (missed.length > 0 && changed === 0) {
    if (missed.some((copy) => copy.miss === "failed")) {
      return {
        phase: "unconfirmed",
        tone: "warning",
        busy: false,
        progress: null,
        retry,
        title: formatMessage({
          id: "cockpit.garden.pool.reward.unconfirmed",
          defaultMessage: "The request didn't finish",
        }),
        description: formatMessage({
          id: "cockpit.garden.pool.reward.unconfirmedHint",
          defaultMessage:
            "Some may have changed anyway. Try Again sets the rest; setting a reward twice changes nothing.",
        }),
      };
    }
    const declined = missed.every((copy) => copy.miss === "declined");
    return {
      phase: declined ? "declined" : "refused",
      tone: "error",
      busy: false,
      progress: null,
      retry,
      title: formatMessage({
        id: "cockpit.garden.pool.reward.nothing",
        defaultMessage: "Nothing was changed",
      }),
      description: declined
        ? formatMessage({
            id: "cockpit.garden.pool.reward.declinedHint",
            defaultMessage:
              "Your wallet declined the request. The rewards are as they were, and Try Again asks once more.",
          })
        : formatMessage({
            id: "cockpit.garden.pool.reward.refusedHint",
            defaultMessage:
              "The request didn't go through. The rewards are as they were; check the amount, then Try Again.",
          }),
    };
  }
  if (missed.length > 0) {
    return {
      phase: "partial",
      tone: "warning",
      busy: false,
      progress,
      retry,
      title: formatMessage(
        {
          id: "cockpit.garden.pool.reward.partial",
          defaultMessage: "{changed} changed · {left} didn't change",
        },
        { changed, left: missed.length }
      ),
      description: formatMessage(
        {
          id: "cockpit.garden.pool.reward.partialHint",
          defaultMessage: "Try Again ({left}) changes only those, to the same amount.",
        },
        { left: missed.length }
      ),
    };
  }
  return {
    phase: "changed",
    tone: "success",
    busy: false,
    progress,
    retry: [],
    title: formatMessage(
      {
        id: "cockpit.garden.pool.reward.changed",
        defaultMessage: "{count, plural, one {The reward is changed} other {# rewards changed}}",
      },
      { count: changed }
    ),
    description: formatMessage({
      id: "cockpit.garden.pool.reward.changedHint",
      defaultMessage: "Anyone who takes one up from now agrees to the new reward.",
    }),
  };
}

/**
 * The rows under the summary's status lines, which stay put while it changes:
 * the available copies from their reward to the new one, the taken ones at
 * theirs, and the most the group could pay once every copy is kept.
 */
type RewardSummaryAmount = { current: string; readCents: bigint | null; estimated: boolean };

export function editRewardSummary(input: {
  available: readonly RewardSummaryAmount[];
  taken: readonly RewardSummaryAmount[];
  /** The new reward in cents, once the steward has typed one. */
  newCents: bigint | null;
  formatUsd: (cents: bigint) => string;
  formatMessage: FormatMessage;
}): Array<[string, string]> {
  const { available, taken, newCents, formatUsd, formatMessage } = input;
  const total = (agreements: readonly RewardSummaryAmount[]) =>
    agreements.reduce<bigint | null>(
      (total, agreement) =>
        total === null || agreement.readCents === null ? null : total + agreement.readCents,
      0n
    );
  const takenTotal = total(taken);
  const amountsText = (agreements: readonly RewardSummaryAmount[]) => {
    const amounts = new Map<string, number>();
    for (const agreement of agreements)
      amounts.set(agreement.current, (amounts.get(agreement.current) ?? 0) + 1);
    return [...amounts].map(([amount, count]) => `${count} × ${amount}`).join(" · ");
  };
  const upTo = (availableTotal: bigint | null, estimated: boolean) =>
    availableTotal === null || takenTotal === null
      ? "—"
      : formatMessage(
          { id: "cockpit.garden.pool.reward.upTo", defaultMessage: "up to {amount}" },
          {
            amount:
              estimated || taken.some((agreement) => agreement.estimated)
                ? formatMessage(
                    { id: "cockpit.garden.pool.reward.about", defaultMessage: "about {amount}" },
                    { amount: formatUsd(availableTotal + takenTotal) }
                  )
                : formatUsd(availableTotal + takenTotal),
          }
        );
  const rows: Array<[string, string]> = [
    [
      formatMessage(
        { id: "cockpit.garden.pool.reward.availableRow", defaultMessage: "{count} available" },
        { count: available.length }
      ),
      formatMessage(
        { id: "cockpit.garden.pool.reward.fromTo", defaultMessage: "{from} → {to} each" },
        {
          from: available.every((agreement) => agreement.current === available[0]?.current)
            ? (available[0]?.current ?? "—")
            : amountsText(available),
          to: newCents === null ? "—" : formatUsd(newCents),
        }
      ),
    ],
  ];
  if (taken.length > 0) {
    rows.push([
      formatMessage(
        { id: "cockpit.garden.pool.reward.takenRow", defaultMessage: "{count} taken" },
        { count: taken.length }
      ),
      formatMessage(
        {
          id: "cockpit.garden.pool.reward.takenKeepAgreements",
          defaultMessage: "{amounts} · unchanged, as agreed",
        },
        { amounts: amountsText(taken) }
      ),
    ]);
  }
  rows.push([
    formatMessage({
      id: "cockpit.garden.pool.reward.allKept",
      defaultMessage: "Reward if all are kept",
    }),
    formatMessage(
      { id: "cockpit.garden.pool.reward.totalFromTo", defaultMessage: "{from} → {to}" },
      {
        from: upTo(
          total(available),
          available.some((agreement) => agreement.estimated)
        ),
        to: upTo(newCents === null ? null : newCents * BigInt(available.length), false),
      }
    ),
  ]);
  return rows;
}
