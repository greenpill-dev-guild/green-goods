/**
 * What Add to This Group's one summary says (PRD-1022 screens 28–30): the same
 * pass as Seed Promises (`creationPass`), in the words of adding to a group that
 * already exists.
 */

import type {
  CreationSendMode,
  SeedCopyProgress,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type {
  CommitmentCycleRecord,
  CommitmentPoolRecord,
  CommitmentReadModel,
} from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";
import type { FlowStatusTone } from "@/components/Layout/FlowStatusRow";
import { type CreationPassState, creationPass } from "../Seed/creationPass";
import type { AddToGroupRefusal } from "./SeedMoreDialog";

/**
 * Why Add to This Group is closed, if it is. Every copy keeps the group's
 * deadline, pool and cycle, and the chain creates into an open pool and an open
 * cycle only, so a closed one would ask the wallet for a send it refuses. Only
 * the group's creator adds to it, so it stays one group.
 */
export function addToGroupRefusal(input: {
  first: Pick<CommitmentReadModel, "creator" | "cycleId" | "dueDate">;
  poolState: CommitmentPoolRecord["state"] | undefined;
  cycle: Pick<CommitmentCycleRecord, "state"> | undefined;
  viewer: Address | null | undefined;
  now: number;
}): AddToGroupRefusal | null {
  const { first, viewer } = input;
  if (Number(first.dueDate ?? 0n) * 1000 <= input.now) return "expired";
  const cycleOpen = !first.cycleId || input.cycle?.state === "OPEN";
  if (input.poolState !== "OPEN" || !cycleOpen) return "closed";
  return viewer && first.creator?.toLowerCase() === viewer.toLowerCase() ? null : "not-creator";
}

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

export interface AddToGroupStatus {
  phase: CreationPassState["phase"];
  tone: FlowStatusTone;
  busy: boolean;
  title: string;
  description: string;
  progress: number | null;
  /** How many Try Again sends. */
  retry: number;
}

export function addToGroupStatus(input: {
  mode: CreationSendMode | null;
  isSending: boolean;
  copies: readonly SeedCopyProgress[] | null;
  pass: readonly SeedCopyProgress[] | null;
  /** How many an Add would make now. */
  count: number;
  formatMessage: FormatMessage;
}): AddToGroupStatus {
  const { count, formatMessage } = input;
  const state = creationPass(input);
  const base = { busy: false, progress: null, retry: 0 };
  switch (state.phase) {
    case "ready":
      return {
        ...base,
        phase: "ready",
        tone: "neutral",
        title: formatMessage(
          {
            id: "cockpit.garden.pool.add.ready",
            defaultMessage:
              "{count, plural, one {Adds one promise to this group} other {Adds # promises to this group}}",
          },
          { count }
        ),
        description: formatMessage({
          id: "cockpit.garden.pool.add.readyHint",
          defaultMessage: "Same terms, deadline and G$ amount as the group.",
        }),
      };
    case "sending":
      return {
        ...base,
        phase: "sending",
        tone: "info",
        busy: true,
        progress: state.progress,
        title: formatMessage(
          {
            id: "cockpit.garden.pool.seed.status.sending",
            defaultMessage: "Confirm in your wallet ({current} of {total})",
          },
          { current: state.current, total: state.total }
        ),
        description: formatMessage(
          {
            id: "cockpit.garden.pool.add.sendingHint",
            defaultMessage:
              "{added} added so far. This wallet asks once per promise; declining one skips only that one.",
          },
          { added: state.created }
        ),
      };
    case "confirming":
      return {
        ...base,
        phase: "confirming",
        tone: "info",
        busy: true,
        title: formatMessage(
          {
            id: "cockpit.garden.pool.add.confirming",
            defaultMessage: "{count, plural, one {Adding the promise} other {Adding # promises}}",
          },
          { count: state.inRequest }
        ),
        description: formatMessage({
          id: "cockpit.garden.pool.seed.status.confirmingHint",
          defaultMessage: "Your wallet approved. Waiting for the chain to confirm.",
        }),
      };
    case "asking":
      return {
        ...base,
        phase: "asking",
        tone: "info",
        busy: true,
        title:
          state.requests > 1
            ? formatMessage(
                {
                  id: "cockpit.garden.pool.seed.status.askingOf",
                  defaultMessage:
                    "{count, plural, one {Approve in your wallet: one promise ({current} of {requests})} other {Approve in your wallet: # promises in one request ({current} of {requests})}}",
                },
                { count: state.inRequest, current: state.request, requests: state.requests }
              )
            : formatMessage(
                {
                  id: "cockpit.garden.pool.add.asking",
                  defaultMessage:
                    "{count, plural, one {Approve in your wallet} other {Approve all # in one request}}",
                },
                { count: state.inRequest }
              ),
        description: formatMessage(
          {
            id: "cockpit.garden.pool.add.askingHint",
            defaultMessage:
              "{count, plural, one {It is added once your wallet approves.} other {Your wallet adds them together: all #, or none if it declines.}}",
          },
          { count: state.inRequest }
        ),
      };
    case "unconfirmed":
      return {
        ...base,
        phase: "unconfirmed",
        tone: "warning",
        retry: state.retry,
        title: formatMessage({
          id: "cockpit.garden.pool.seed.status.unconfirmed",
          defaultMessage: "The request didn't finish",
        }),
        description: formatMessage({
          id: "cockpit.garden.pool.add.unconfirmedHint",
          defaultMessage:
            "Some may have been added anyway. Try Again finishes them without adding any twice.",
        }),
      };
    case "declined":
    case "refused":
      return {
        ...base,
        phase: state.phase,
        tone: "error",
        retry: state.retry,
        title: formatMessage({
          id: "cockpit.garden.pool.add.nothing",
          defaultMessage: "Nothing was added",
        }),
        description:
          state.phase === "declined"
            ? formatMessage({
                id: "cockpit.garden.pool.add.declinedHint",
                defaultMessage:
                  "Your wallet declined the request. The group is unchanged, and Try Again asks once more.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.add.refusedHint",
                defaultMessage:
                  "The request didn't go through. The group is unchanged, and Try Again asks once more.",
              }),
      };
    case "partial":
      return {
        ...base,
        phase: "partial",
        tone: "warning",
        progress: state.progress,
        retry: state.notSent,
        title: formatMessage(
          {
            id: "cockpit.garden.pool.add.partial",
            defaultMessage:
              "{added} added · {notSent} didn't send{later, plural, =0 {} one { · # waits} other { · # wait}}",
          },
          { added: state.created, notSent: state.notSent, later: state.later }
        ),
        description: formatMessage(
          {
            id: "cockpit.garden.pool.add.partialHint",
            defaultMessage:
              "Try Again ({notSent}) sends only the ones that didn't send, with the group's terms and deadline.",
          },
          { notSent: state.notSent }
        ),
      };
    case "finishLater":
      return {
        ...base,
        phase: "finishLater",
        tone: "warning",
        progress: state.progress,
        title: formatMessage(
          {
            id: "cockpit.garden.pool.add.finishLater",
            defaultMessage: "{added} added · {later} didn't send",
          },
          { added: state.created, later: state.later }
        ),
        description: formatMessage(
          {
            id: "cockpit.garden.pool.seed.status.finishLaterHint",
            defaultMessage:
              "{later, plural, one {Finish creating the last one from the pool tab when you're ready.} other {Finish creating the last # from the pool tab when you're ready.}}",
          },
          { later: state.later }
        ),
      };
    case "created":
      return {
        ...base,
        phase: "created",
        tone: "success",
        progress: state.progress,
        title: formatMessage(
          {
            id: "cockpit.garden.pool.add.added",
            defaultMessage: "{count, plural, one {The promise is added} other {# promises added}}",
          },
          { count: state.created }
        ),
        description: formatMessage({
          id: "cockpit.garden.pool.add.addedHint",
          defaultMessage: "They join the group's row, with its terms and deadline.",
        }),
      };
  }
}
