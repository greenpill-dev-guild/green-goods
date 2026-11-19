/**
 * What Edit Confirmers' one summary says: ready, the wallet asking, and how a
 * change ended. One function, so the summary, the footer and Try Again never
 * read the same change two ways. It follows Edit Reward's phases
 * (`editRewardStatus`), in its own words.
 */

import type { ConfirmerEditProgress } from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import type { confirmerRuleError } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { CreationSendMode } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type { ReactNode } from "react";
import type { FlowStatusTone } from "@/components/Layout/FlowStatusRow";
import { copiesInRequest, type EditRewardPhase } from "./editRewardStatus";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

export interface EditConfirmersStatus {
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

/** Why a rule can't be saved, in the composer's own words; null when it can. */
export function confirmerRuleMessage(
  error: ReturnType<typeof confirmerRuleError>,
  formatMessage: FormatMessage
): string | null {
  switch (error) {
    case "hub.garden.pool.seed.error.confirmersTooMany":
      return formatMessage({
        id: "hub.garden.pool.seed.error.confirmersTooMany",
        defaultMessage: "That is more confirmers than one promise can name.",
      });
    case "hub.garden.pool.seed.error.thresholdAtLeastOne":
      return formatMessage({
        id: "hub.garden.pool.seed.error.thresholdAtLeastOne",
        defaultMessage: "At least one confirmation is needed.",
      });
    case "hub.garden.pool.seed.error.thresholdAboveGroup":
      return formatMessage({
        id: "hub.garden.pool.seed.error.thresholdAboveGroup",
        defaultMessage: "That asks for more confirmations than there are named confirmers.",
      });
    default:
      return null;
  }
}

/**
 * The summary's rows: the available copies' rule before and after, who the
 * change adds and removes (or, with no one rule to compare with, who it
 * names), and the taken copies kept. The people come ready to draw, since the
 * Hub names them through its own component.
 */
export function editConfirmersSummary(input: {
  available: number;
  taken: number;
  from: string;
  to: string;
  adds: ReactNode | null;
  removes: ReactNode | null;
  names: ReactNode | null;
  formatMessage: FormatMessage;
}): Array<[string, ReactNode]> {
  const { available, taken, from, to, adds, removes, names, formatMessage } = input;
  const rows: Array<[string, ReactNode]> = [
    [
      formatMessage(
        { id: "hub.garden.pool.reward.availableRow", defaultMessage: "{count} available" },
        { count: available }
      ),
      formatMessage(
        { id: "hub.garden.pool.confirmers.fromTo", defaultMessage: "{from} → {to}" },
        { from, to }
      ),
    ],
  ];
  if (names) {
    rows.push([
      formatMessage({ id: "hub.garden.pool.confirmers.names", defaultMessage: "Names" }),
      names,
    ]);
  }
  if (adds) {
    rows.push([
      formatMessage({ id: "hub.garden.pool.confirmers.adds", defaultMessage: "Adds" }),
      adds,
    ]);
  }
  if (removes) {
    rows.push([
      formatMessage({ id: "hub.garden.pool.confirmers.removes", defaultMessage: "Removes" }),
      removes,
    ]);
  }
  if (taken > 0) {
    rows.push([
      formatMessage(
        { id: "hub.garden.pool.reward.takenRow", defaultMessage: "{count} taken" },
        { count: taken }
      ),
      formatMessage({
        id: "hub.garden.pool.confirmers.takenKeep",
        defaultMessage: "Unchanged, as taken up",
      }),
    ]);
  }
  return rows;
}

const IN_FLIGHT = new Set<ConfirmerEditProgress["status"]>(["waiting", "wallet", "confirming"]);

export function editConfirmersStatus(input: {
  mode: CreationSendMode | null;
  isSending: boolean;
  copies: readonly ConfirmerEditProgress[] | null;
  /** Copies nobody has taken: what this changes. */
  available: number;
  /** How many were taken up: they keep the confirmers they were taken up under. */
  taken: number;
  formatMessage: FormatMessage;
}): EditConfirmersStatus {
  const { mode, isSending, copies, available, taken, formatMessage } = input;
  const settled = { busy: false, progress: null, retry: [] as bigint[] };
  if (!copies) {
    return {
      ...settled,
      phase: "ready",
      tone: "neutral",
      title: formatMessage(
        {
          id: "hub.garden.pool.confirmers.ready",
          defaultMessage:
            "{count, plural, one {Changes who confirms the one available promise} other {Changes who confirms # available promises}}",
        },
        { count: available }
      ),
      description:
        taken === 0
          ? formatMessage({
              id: "hub.garden.pool.reward.readyNoneTaken",
              defaultMessage: "Nobody has taken one yet, so every one changes.",
            })
          : formatMessage(
              {
                id: "hub.garden.pool.confirmers.readyTaken",
                defaultMessage:
                  "{count, plural, one {The one already taken keeps the confirmers it was taken up with.} other {The # already taken keep the confirmers they were taken up with.}}",
              },
              { count: taken }
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
    const busy = { busy: true, tone: "info" as const, retry: [] as bigint[] };
    if (oneByOne) {
      return {
        ...busy,
        phase: "sending",
        progress,
        title: formatMessage(
          {
            id: "hub.garden.pool.reward.sending",
            defaultMessage: "Confirm in your wallet ({current} of {total})",
          },
          { current: at + 1, total: copies.length }
        ),
        description: formatMessage(
          {
            id: "hub.garden.pool.reward.sendingHint",
            defaultMessage:
              "{changed} changed so far. This wallet asks once per promise; declining one leaves only that one as it was.",
          },
          { changed }
        ),
      };
    }
    const inRequest = copiesInRequest(copies);
    return copies[at]?.status === "confirming"
      ? {
          ...busy,
          phase: "confirming",
          progress: null,
          title: formatMessage(
            {
              id: "hub.garden.pool.confirmers.confirming",
              defaultMessage:
                "{count, plural, one {Changing who confirms} other {Changing who confirms # promises}}",
            },
            { count: inRequest }
          ),
          description: formatMessage({
            id: "hub.garden.pool.reward.confirmingHint",
            defaultMessage: "Your wallet approved. Waiting for confirmation…",
          }),
        }
      : {
          ...busy,
          phase: "asking",
          progress: null,
          title: formatMessage(
            {
              id: "hub.garden.pool.confirmers.asking",
              defaultMessage:
                "{count, plural, one {Approve in your wallet} other {Approve in your wallet: # promises in one request}}",
            },
            { count: inRequest }
          ),
          description: formatMessage(
            {
              id: "hub.garden.pool.reward.askingHint",
              defaultMessage:
                "{count, plural, one {It changes once your wallet approves.} other {They change together: all #, or none if the wallet declines.}}",
            },
            { count: inRequest }
          ),
        };
  }

  const retry = missed.map((copy) => copy.commitmentId);
  if (missed.length > 0 && changed === 0) {
    if (missed.some((copy) => copy.miss === "failed")) {
      return {
        ...settled,
        phase: "unconfirmed",
        tone: "warning",
        retry,
        title: formatMessage({
          id: "hub.garden.pool.reward.unconfirmed",
          defaultMessage: "The request didn't finish",
        }),
        description: formatMessage({
          id: "hub.garden.pool.confirmers.unconfirmedHint",
          defaultMessage:
            "Some may have changed anyway. Try Again sets the rest; naming the same confirmers twice changes nothing.",
        }),
      };
    }
    const declined = missed.every((copy) => copy.miss === "declined");
    return {
      ...settled,
      phase: declined ? "declined" : "refused",
      tone: "error",
      retry,
      title: formatMessage({
        id: "hub.garden.pool.reward.nothing",
        defaultMessage: "Nothing was changed",
      }),
      description: declined
        ? formatMessage({
            id: "hub.garden.pool.confirmers.declinedHint",
            defaultMessage:
              "Your wallet declined the request. Who confirms is as it was, and Try Again asks once more.",
          })
        : formatMessage({
            id: "hub.garden.pool.confirmers.refusedHint",
            defaultMessage:
              "The request didn't go through, so who confirms is as it was. A voucher offer's confirmers can't change; check the list, then Try Again.",
          }),
    };
  }
  if (missed.length > 0) {
    return {
      ...settled,
      phase: "partial",
      tone: "warning",
      progress,
      retry,
      title: formatMessage(
        {
          id: "hub.garden.pool.reward.partial",
          defaultMessage: "{changed} changed · {left} didn't change",
        },
        { changed, left: missed.length }
      ),
      description: formatMessage(
        {
          id: "hub.garden.pool.confirmers.partialHint",
          defaultMessage: "Try Again ({left}) changes only those, to the same confirmers.",
        },
        { left: missed.length }
      ),
    };
  }
  return {
    ...settled,
    phase: "changed",
    tone: "success",
    progress,
    title: formatMessage(
      {
        id: "hub.garden.pool.confirmers.changed",
        defaultMessage:
          "{count, plural, one {Confirmers changed} other {Confirmers changed on # promises}}",
      },
      { count: changed }
    ),
    description: formatMessage({
      id: "hub.garden.pool.confirmers.changedHint",
      defaultMessage: "Anyone who takes one up from now has these confirmers.",
    }),
  };
}
