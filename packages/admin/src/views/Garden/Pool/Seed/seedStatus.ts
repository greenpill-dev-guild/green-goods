/**
 * What the Review's one status row says (PRD-1022 screens 05–12): ready, the
 * wallet asking, sending, and how a pass ended. One function, so the status
 * row, the footer's note and its buttons never read the same pass two ways.
 */

import {
  CREATION_BUNDLE_SIZE,
  countSeedCopies,
  type CreationSendMode,
  type SeedCopyProgress,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type { FlowStatusTone } from "@/components/Layout/FlowStatusRow";

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

const IN_FLIGHT = new Set<SeedCopyProgress["status"]>([
  "waiting",
  "preparing",
  "wallet",
  "confirming",
]);

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
  const { mode, isSending, copies, pass, total, grouped, formatMessage } = input;
  const oneByOne = mode === "one-by-one";
  if (!copies) {
    return {
      phase: "ready",
      tone: "neutral",
      busy: false,
      progress: null,
      retry: 0,
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
  }

  const counts = countSeedCopies(copies);
  const progress = oneByOne ? (counts.created / Math.max(1, counts.total)) * 100 : null;
  if (isSending) {
    // The wallet is asked about this Create's copies, not the whole set: a Try
    // Again of three asks about three. A copy the queue refused never reaches
    // it, and the copies go in order, so the first unfinished one is the
    // current prompt, or leads the current request.
    const sending = (pass ?? []).filter((copy) => copy.jobId !== null);
    const at = Math.max(
      0,
      sending.findIndex((copy) => IN_FLIGHT.has(copy.status))
    );
    const confirming = sending[at]?.status === "confirming";
    if (oneByOne) {
      return {
        phase: "sending",
        tone: "info",
        busy: true,
        progress,
        retry: 0,
        title: formatMessage(
          {
            id: "cockpit.garden.pool.seed.status.sending",
            defaultMessage: "Confirm in your wallet ({current} of {total})",
          },
          { current: at + 1, total: Math.max(sending.length, 1) }
        ),
        description: formatMessage(
          {
            id: "cockpit.garden.pool.seed.status.sendingHint",
            defaultMessage:
              "{created} created so far. This wallet asks once per promise; declining one skips only that one.",
          },
          { created: counts.created }
        ),
      };
    }
    const request = Math.floor(at / CREATION_BUNDLE_SIZE);
    const requests = Math.max(1, Math.ceil(sending.length / CREATION_BUNDLE_SIZE));
    const inRequest = Math.max(
      1,
      Math.min(CREATION_BUNDLE_SIZE, sending.length - request * CREATION_BUNDLE_SIZE)
    );
    return confirming
      ? {
          phase: "confirming",
          tone: "info",
          busy: true,
          progress: null,
          retry: 0,
          title: formatMessage(
            {
              id: "cockpit.garden.pool.seed.status.confirming",
              defaultMessage:
                "{count, plural, one {Creating the promise} other {Creating # promises}}",
            },
            { count: inRequest }
          ),
          description: formatMessage({
            id: "cockpit.garden.pool.seed.status.confirmingHint",
            defaultMessage: "Your wallet approved. Waiting for the chain to confirm.",
          }),
        }
      : {
          phase: "asking",
          tone: "info",
          busy: true,
          progress: null,
          retry: 0,
          title:
            requests > 1
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.status.askingOf",
                    defaultMessage:
                      "{count, plural, one {Approve in your wallet: one promise ({current} of {requests})} other {Approve in your wallet: # promises in one request ({current} of {requests})}}",
                  },
                  { count: inRequest, current: request + 1, requests }
                )
              : formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.status.asking",
                    defaultMessage:
                      "{count, plural, one {Approve in your wallet} other {Approve in your wallet: # promises in one request}}",
                  },
                  { count: inRequest }
                ),
          description: formatMessage(
            {
              id: "cockpit.garden.pool.seed.status.askingHint",
              defaultMessage:
                "{count, plural, one {It is created once your wallet approves.} other {They are created together: all #, or none if the wallet declines.}}",
            },
            { count: inRequest }
          ),
        };
  }

  if (counts.notSent > 0 && counts.created === 0 && counts.later === 0) {
    const missed = copies.filter((copy) => copy.status === "not-sent");
    // A lost answer is no proof that nothing was created. Try Again is safe
    // either way: the chain returns a promise it already has instead of making
    // it twice.
    if (missed.some((copy) => copy.miss === "failed")) {
      return {
        phase: "unconfirmed",
        tone: "warning",
        busy: false,
        progress: null,
        retry: counts.notSent,
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
    }
    const declined = missed.every((copy) => copy.miss === "declined");
    return {
      phase: declined ? "declined" : "refused",
      tone: "error",
      busy: false,
      progress: null,
      retry: counts.notSent,
      title: formatMessage({
        id: "cockpit.garden.pool.seed.status.nothing",
        defaultMessage: "Nothing was created",
      }),
      description: declined
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
  }
  if (counts.notSent > 0) {
    return {
      phase: "partial",
      tone: "warning",
      busy: false,
      progress,
      retry: counts.notSent,
      title: formatMessage(
        {
          id: "cockpit.garden.pool.seed.status.partial",
          defaultMessage:
            "{created} created · {notSent} didn't send{later, plural, =0 {} other { · # waits}}",
        },
        { created: counts.created, notSent: counts.notSent, later: counts.later }
      ),
      description: formatMessage(
        {
          id: "cockpit.garden.pool.seed.status.partialHint",
          defaultMessage:
            "Try Again ({notSent}) sends only the ones that didn't send, with the same answers and deadline.{later, plural, =0 {} one { The one that waits is on the pool tab.} other { The ones that wait are on the pool tab.}}",
        },
        { notSent: counts.notSent, later: counts.later }
      ),
    };
  }
  if (counts.later > 0) {
    return {
      phase: "finishLater",
      tone: "warning",
      busy: false,
      progress,
      retry: 0,
      title: formatMessage(
        {
          id: "cockpit.garden.pool.seed.status.finishLater",
          defaultMessage: "{created} created · {later} didn't send",
        },
        { created: counts.created, later: counts.later }
      ),
      description: formatMessage(
        {
          id: "cockpit.garden.pool.seed.status.finishLaterHint",
          defaultMessage:
            "{later, plural, one {Finish creating the last one from the pool tab when you're ready.} other {Finish creating the last # from the pool tab when you're ready.}}",
        },
        { later: counts.later }
      ),
    };
  }
  return {
    phase: "created",
    tone: "success",
    busy: false,
    progress,
    retry: 0,
    title: formatMessage(
      {
        id: "cockpit.garden.pool.seed.status.created",
        defaultMessage: "{count, plural, one {The promise is created} other {# promises created}}",
      },
      { count: counts.created }
    ),
    description: grouped
      ? formatMessage({
          id: "cockpit.garden.pool.seed.status.createdGroup",
          defaultMessage: "Gardeners can take them up now. They show as one group on the pool tab.",
        })
      : formatMessage(
          {
            id: "cockpit.garden.pool.seed.status.createdHint",
            defaultMessage:
              "{count, plural, one {Gardeners can take it up now.} other {Gardeners can take them up now.}}",
          },
          { count: counts.created }
        ),
  };
}
