/**
 * What the Review's one status row says (PRD-1022 screens 05–12): ready, the
 * wallet asking, sending, and how a pass ended. One function, so the status
 * row, the footer's note and its buttons never read the same pass two ways.
 */

import type {
  CreationSendMode,
  SeedCopyProgress,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type { FlowStatusTone } from "@/components/Layout/FlowStatusRow";
import { creationPass } from "./creationPass";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

export type SeedPhase =
  | "ready"
  | "asking"
  | "confirming"
  | "sending"
  | "declined"
  | "refused"
  | "unconfirmed"
  | "partial"
  | "finishLater"
  | "created";

export interface SeedStatusView {
  phase: SeedPhase;
  tone: FlowStatusTone;
  busy: boolean;
  title: string;
  description: string;
  /** Only for a wallet that is asked once per promise. */
  progress: number | null;
  /** How many promises Try Again sends. */
  retry: number;
}

export function seedStatusView(input: {
  mode: CreationSendMode | null;
  isSending: boolean;
  /** Every copy sent at least once in this sitting; null before the first Create. */
  copies: readonly SeedCopyProgress[] | null;
  /** The copies the latest Create sent, in its order; null before the first Create. */
  pass: readonly SeedCopyProgress[] | null;
  /** How many promises a Create would make now. */
  total: number;
  /** Some row makes several promises, so they show as a group. */
  grouped: boolean;
  formatMessage: FormatMessage;
}): SeedStatusView {
  const { total, grouped, formatMessage } = input;
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
            id: "cockpit.garden.pool.seed.status.ready",
            defaultMessage:
              "{total, plural, one {Creates one promise} other {Creates # separate promises}}",
          },
          { total }
        ),
        description: formatMessage({
          id: "cockpit.garden.pool.seed.status.readyHint",
          defaultMessage: "Each one is taken up, proven and confirmed on its own.",
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
            id: "cockpit.garden.pool.seed.status.sendingHint",
            defaultMessage:
              "{created} created so far. This wallet asks once per promise; declining one skips only that one.",
          },
          { created: state.created }
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
            id: "cockpit.garden.pool.seed.status.confirming",
            defaultMessage:
              "{count, plural, one {Creating the promise} other {Creating # promises}}",
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
                  id: "cockpit.garden.pool.seed.status.asking",
                  defaultMessage:
                    "{count, plural, one {Approve in your wallet} other {Approve in your wallet: # promises in one request}}",
                },
                { count: state.inRequest }
              ),
        description: formatMessage(
          {
            id: "cockpit.garden.pool.seed.status.askingHint",
            defaultMessage:
              "{count, plural, one {It is created once your wallet approves.} other {They are created together: all #, or none if the wallet declines.}}",
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
          id: "cockpit.garden.pool.seed.status.unconfirmedHint",
          defaultMessage:
            "Some may have been created anyway. Try Again finishes them without creating any twice.",
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
          id: "cockpit.garden.pool.seed.status.nothing",
          defaultMessage: "Nothing was created",
        }),
        description:
          state.phase === "declined"
            ? formatMessage({
                id: "cockpit.garden.pool.seed.status.declinedHint",
                defaultMessage:
                  "Your wallet declined the request. Your answers are still here, and Try Again asks once more.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.seed.status.refusedHint",
                defaultMessage:
                  "The request didn't go through. Your answers are still here; check them, then Try Again.",
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
            id: "cockpit.garden.pool.seed.status.partial",
            defaultMessage:
              "{created} created · {notSent} didn't send{later, plural, =0 {} one { · # waits} other { · # wait}}",
          },
          { created: state.created, notSent: state.notSent, later: state.later }
        ),
        description: formatMessage(
          {
            id: "cockpit.garden.pool.seed.status.partialHint",
            defaultMessage:
              "Try Again ({notSent}) sends only the ones that didn't send, with the same answers and deadline.{later, plural, =0 {} one { The one that waits is on the pool tab.} other { The ones that wait are on the pool tab.}}",
          },
          { notSent: state.notSent, later: state.later }
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
            id: "cockpit.garden.pool.seed.status.finishLater",
            defaultMessage: "{created} created · {later} didn't send",
          },
          { created: state.created, later: state.later }
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
            id: "cockpit.garden.pool.seed.status.created",
            defaultMessage:
              "{count, plural, one {The promise is created} other {# promises created}}",
          },
          { count: state.created }
        ),
        description: grouped
          ? formatMessage({
              id: "cockpit.garden.pool.seed.status.createdGroup",
              defaultMessage:
                "Gardeners can take them up now. They show as one group on the pool tab.",
            })
          : formatMessage(
              {
                id: "cockpit.garden.pool.seed.status.createdHint",
                defaultMessage:
                  "{count, plural, one {Gardeners can take it up now.} other {Gardeners can take them up now.}}",
              },
              { count: state.created }
            ),
      };
  }
}
