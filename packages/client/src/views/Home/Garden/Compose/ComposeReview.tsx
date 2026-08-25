import { Alert } from "@green-goods/shared/components/Alert";
import {
  type CommitmentComposerValues,
  type CommitmentCycleRecord,
  type CycleMetadataNameResolution,
} from "@green-goods/shared/commitment-pooling";
import { type RefObject, useEffect } from "react";
import { useIntl } from "react-intl";

export interface ComposeReviewProps {
  values: CommitmentComposerValues;
  isOnline: boolean;
  hasPool: boolean;
  gardenName: string | null;
  openCycles: CommitmentCycleRecord[];
  cycleNames: Map<string, CycleMetadataNameResolution>;
  /** Names the chosen actions; a row the registry cannot name keeps its uid. */
  actionTitle: (actionUID: string) => string;
  /** The reader has reached the end. Sending from the top is not reviewing. */
  onReadToEnd: () => void;
  /** The end of the review, owned by the caller so its bar can scroll to it. */
  endRef: RefObject<HTMLDivElement | null>;
}

/**
 * The last look before it becomes real.
 *
 * It reads in the order it was filled in, in the same sectioned grammar the
 * commitment's own screen uses afterwards: what it is, how much, when, where,
 * what has to be approved, who confirms, the team, the note. Then it says what
 * placing it does to other people, which is the part a summary of the form
 * cannot say, and, when the phone is offline, that it will wait rather than
 * quietly failing.
 */
export function ComposeReview({
  values,
  isOnline,
  hasPool,
  gardenName,
  openCycles,
  cycleNames,
  actionTitle,
  onReadToEnd,
  endRef,
}: ComposeReviewProps) {
  const { formatMessage } = useIntl();
  const isRequest = values.direction === "REQUEST";
  const isGardenWork = values.kind === "GARDEN_WORK";
  // The act unlocks once the end of the review has been on screen. Where the
  // platform cannot observe that (no IntersectionObserver), the gate is not
  // pretended: the review is treated as read.
  useEffect(() => {
    const node = endRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      onReadToEnd();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onReadToEnd();
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onReadToEnd, endRef]);

  const cycle = openCycles.find((candidate) => candidate.cycleId.toString() === values.cycleId);
  const whereValue = cycle
    ? [
        formatMessage({
          id: cycle.cycleType === "CAMPAIGN" ? "app.pool.rail.campaign" : "app.pool.rail.season",
        }),
        cycleNames.get(cycle.cycleId.toString())?.name ?? null,
      ]
        .filter(Boolean)
        .join(" · ")
    : formatMessage({ id: "app.compose.review.whereNone" });

  const rows: { label: string; value: string }[] = [
    {
      label: formatMessage({ id: "app.compose.review.garden" }),
      value: gardenName ?? formatMessage({ id: "app.compose.review.thisGarden" }),
    },
    {
      label: formatMessage({
        id: isRequest ? "app.compose.review.whatRequest" : "app.compose.review.whatOffer",
      }),
      value: `${values.title.trim()} · ${formatMessage({
        id: isGardenWork ? "app.compose.kind.work.title" : "app.compose.kind.service.title",
      })}`,
    },
    {
      label: formatMessage({ id: "app.compose.review.howMuch" }),
      value: formatMessage(
        { id: "app.commitments.row.units" },
        { count: String(values.targetUnits), unit: values.unitLabel.trim() }
      ),
    },
    {
      label: formatMessage({ id: "app.compose.terms.byWhen" }),
      value: formatMessage({ id: "app.compose.terms.days" }, { count: values.dueInDays }),
    },
    { label: formatMessage({ id: "app.compose.what.whereLabel" }), value: whereValue },
  ];
  if (isGardenWork) {
    rows.push({
      label: formatMessage({ id: "app.compose.proof.title" }),
      value: values.requirements
        .map(
          (row) =>
            `${actionTitle(row.actionUID)} ${formatMessage(
              { id: "app.compose.proof.times" },
              { count: row.requiredCount }
            )}`
        )
        .join(" · "),
    });
  }
  if (isRequest) {
    rows.push({
      label: formatMessage({ id: "app.compose.claimMode.legend" }),
      value: formatMessage({ id: `app.compose.claimMode.${values.claimMode}.title` }),
    });
  }
  rows.push(
    {
      label: formatMessage({ id: "app.compose.details.whoConfirms" }),
      value: [
        formatMessage({
          id: isRequest
            ? isGardenWork
              ? "app.compose.details.confirmer.requestWork"
              : "app.compose.details.confirmer.request"
            : "app.compose.details.confirmer.offer",
        }),
        values.protocolFallbackEnabled
          ? formatMessage({ id: "app.compose.review.fallbackOn" })
          : formatMessage({ id: "app.compose.review.fallbackOff" }),
      ].join(" "),
    },
    {
      label: formatMessage({ id: "app.compose.details.team" }),
      value: formatMessage({
        id: values.openTeam ? "app.compose.review.teamOpen" : "app.compose.review.teamLed",
      }),
    }
  );
  const note = values.note?.trim();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-text-strong-950">
        {formatMessage({ id: "app.compose.review.legend" })}
      </h1>

      <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
          {formatMessage({ id: "app.compose.review.detailsHeading" })}
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-text-soft-400">{row.label}</dt>
              <dd className="mt-0.5 text-text-strong-950">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {note || values.links.length > 0 ? (
        <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
            {formatMessage({ id: "app.compose.details.addDetails" })}
          </h2>
          {note ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-sub-600">
              {note}
            </p>
          ) : null}
          {values.links.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm">
              {values.links.map((url) => (
                <li key={url} className="truncate text-text-strong-950" title={url}>
                  {url}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <p className="text-sm leading-relaxed text-text-sub-600">
        {formatMessage({
          id: isRequest
            ? isGardenWork
              ? "app.compose.review.consequenceRequestWork"
              : "app.compose.review.consequenceRequest"
            : "app.compose.review.consequenceOffer",
        })}
      </p>

      {!hasPool ? (
        <Alert variant="error" className="p-3">
          {formatMessage({ id: "app.compose.review.noPool" })}
        </Alert>
      ) : null}

      {!isOnline ? (
        <Alert variant="warning" className="p-3">
          {formatMessage({ id: "app.compose.review.offline" })}
        </Alert>
      ) : null}

      <p className="text-xs text-text-soft-400">
        {formatMessage({ id: "app.compose.review.queues" })}
      </p>
      <div ref={endRef} aria-hidden="true" data-component="ComposeReviewEnd" />
    </div>
  );
}
