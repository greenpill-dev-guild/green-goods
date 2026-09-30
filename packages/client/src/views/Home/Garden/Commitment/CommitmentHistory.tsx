import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import {
  type CommitmentEventRecord,
  type CommitmentReadModel,
  useCommitmentActivity,
} from "@green-goods/shared/commitment-pooling";
import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type ReactNode, useId } from "react";
import { type IntlShape, useIntl } from "react-intl";

/** How many lines the page reads: a promise's life is short, and older lines stay on the record. */
const HISTORY_LIMIT = 20;

/**
 * Each event as a line in the member's words, keyed by the indexer's event type.
 * Lines that name who acted take `{who}` (you or someone else, so each language
 * can conjugate) and `{actor}`; the rest are plain facts. Unknown types are left
 * out rather than printed raw.
 */
const LINE_IDS: Record<string, string> = {
  CLAIM_REQUESTED: "app.commitment.history.claimRequested",
  CLAIM_DECLINED: "app.commitment.history.claimDeclined",
  ACCEPTED: "app.commitment.history.accepted",
  CONTRIBUTOR_ADDED: "app.commitment.history.joined",
  CONTRIBUTOR_REMOVED: "app.commitment.history.left",
  CONTRIBUTOR_ROSTER_FROZEN: "app.commitment.history.teamSettled",
  WORK_LINKED: "app.commitment.history.workLinked",
  WORK_UNLINKED: "app.commitment.history.workUnlinked",
  APPROVED_WORK_COUNTED: "app.commitment.history.workApproved",
  EVIDENCE_ATTACHED: "app.commitment.history.proofAdded",
  ASSESSMENT_ATTACHED: "app.commitment.history.assessment",
  READY_FOR_CONFIRMATION: "app.commitment.history.sent",
  CONFIRMATION_RECORDED: "app.commitment.history.confirmed",
  FULFILLED: "app.commitment.history.kept",
  CANCELLED: "app.commitment.history.withdrawn",
  EXPIRED: "app.commitment.history.expired",
  DISPUTED: "app.commitment.history.disputed",
  DISPUTE_RESOLVED: "app.commitment.history.resolved",
  CONSIDERATION_DECLARED: "app.commitment.history.reward",
  CONSIDERATION_PAID: "app.commitment.history.payout",
  CONFIRMER_RULE_SET: "app.commitment.history.confirmers",
};

function lineId(event: CommitmentEventRecord, direction: CommitmentReadModel["direction"]) {
  if (event.eventType === "CREATED") {
    return direction === "REQUEST"
      ? "app.commitment.history.createdRequest"
      : "app.commitment.history.createdOffer";
  }
  return LINE_IDS[event.eventType] ?? null;
}

/** "Today · 10:24 AM", or the date and time for older lines. */
function formatWhen(intl: IntlShape, seconds: number): string {
  const at = new Date(seconds * 1000);
  const time = intl.formatTime(at, { hour: "numeric", minute: "2-digit" });
  return at.toDateString() === new Date().toDateString()
    ? intl.formatMessage({ id: "app.commitment.history.today" }, { time })
    : intl.formatMessage(
        { id: "app.commitment.history.when" },
        { date: intl.formatDate(at, { month: "short", day: "numeric", year: "numeric" }), time }
      );
}

interface CommitmentHistoryProps {
  chainId: number;
  commitment: CommitmentReadModel;
  viewer?: Address | null;
  /**
   * An act still on this phone, drawn first on a dashed node: it is not on the
   * record yet. `at` is when this phone last touched it, in milliseconds.
   */
  localLine?: { text: string; at: number } | null;
}

/**
 * What has happened to the promise, newest first, from the same activity read
 * the stewards' timeline uses. The newest line's node is green; an act still on
 * this phone leads on a dashed node until it lands.
 */
export function CommitmentHistory({
  chainId,
  commitment,
  viewer,
  localLine,
}: CommitmentHistoryProps) {
  const intl = useIntl();
  const headingId = useId();
  const { events, isError } = useCommitmentActivity({
    chainId,
    commitmentId: commitment.commitmentId,
    limit: HISTORY_LIMIT,
  });
  // A confirmation that keeps the promise lands in the same transaction as the
  // promise being kept; the one line that says who confirmed it says both.
  const confirmationTx = new Set(
    events
      .filter((event) => event.eventType === "CONFIRMATION_RECORDED")
      .map((event) => event.txHash)
  );
  const lines = events.flatMap((event) => {
    if (event.eventType === "FULFILLED" && confirmationTx.has(event.txHash)) return [];
    const id = lineId(event, commitment.direction);
    if (!id) return [];
    const you = Boolean(
      viewer && event.actor && event.actor.toLowerCase() === viewer.toLowerCase()
    );
    const actor: ReactNode = event.actor ? (
      <AddressDisplay address={event.actor} interactive={false} className="inline" />
    ) : null;
    return [
      {
        key: event.id,
        text: intl.formatMessage(
          { id },
          { who: you ? "you" : event.actor ? "other" : "someone", actor }
        ),
        when: formatWhen(intl, event.timestamp),
      },
    ];
  });

  if (!localLine && lines.length === 0 && !isError) return null;

  return (
    <section
      className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="text-sm font-semibold leading-5 text-text-strong-950">
        {intl.formatMessage({ id: "app.commitment.history.title" })}
      </h2>
      {isError && lines.length === 0 ? (
        <p className="mt-2 text-sm text-text-sub-600">
          {intl.formatMessage({ id: "app.commitment.history.unavailable" })}
        </p>
      ) : null}
      <ol className="mt-3">
        {localLine ? (
          <HistoryLine
            text={localLine.text}
            when={formatWhen(intl, localLine.at / 1000)}
            local
            latest={false}
          />
        ) : null}
        {lines.map((line, index) => (
          <HistoryLine
            key={line.key}
            text={line.text}
            when={line.when}
            latest={!localLine && index === 0}
          />
        ))}
      </ol>
    </section>
  );
}

function HistoryLine({
  text,
  when,
  latest,
  local = false,
}: {
  text: ReactNode;
  when?: string;
  latest: boolean;
  local?: boolean;
}) {
  return (
    <li
      className="group relative grid grid-cols-[0.75rem_1fr] gap-3 pb-3.5 last:pb-0"
      data-latest={latest ? "true" : undefined}
      data-local={local ? "true" : undefined}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-0 start-[0.3125rem] top-3.5 w-px bg-stroke-soft-200 group-last:hidden"
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-[0.3125rem] h-2.5 w-2.5 rounded-full",
          local
            ? "border border-dashed border-warning-base"
            : latest
              ? "bg-primary"
              : "bg-stroke-sub-300"
        )}
      />
      <div className="min-w-0">
        <p className="text-sm text-text-strong-950">{text}</p>
        {when ? <p className="text-xs text-text-sub-600">{when}</p> : null}
      </div>
    </li>
  );
}
