import { Button } from "@green-goods/shared/components/Button";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  type CommitmentUnitSummaryRecord,
  cycleStanding,
  type PublicCommitmentCycleRecord,
} from "@green-goods/shared/commitment-pooling/public";
import { useEffect, useRef, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { EditorialHeading } from "@/components/Public/atoms";

/**
 * The blocks inside the public Garden page's `§ 02 Commitments` panel: the
 * open Season and Campaign rows, the pool-wide unit rows, the finished-cycle
 * history, and the certificates tie-in. Split out of
 * `GardenDetailCommitments.tsx` to keep that file under the source-structure
 * ceiling; they have no meaning outside it.
 */

const META_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-soft-400";

const ARROW_LINK_CLASS =
  "group inline-flex shrink-0 items-center gap-2 border-b border-primary-action/35 pb-0.5 text-sm font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2";

function cycleTypeLabel(formatMessage: IntlShape["formatMessage"], cycleType: string | null) {
  return cycleType === "CAMPAIGN"
    ? formatMessage({ id: "public.pool.garden.cycle.campaign", defaultMessage: "Campaign" })
    : formatMessage({ id: "public.pool.garden.cycle.season", defaultMessage: "Season" });
}

function cycleName(intl: IntlShape, cycle: PublicCommitmentCycleRecord): string {
  return (
    cycle.name ??
    intl.formatMessage({
      id: "public.pool.garden.cycle.nameUnavailable",
      defaultMessage: "Name not available",
    })
  );
}

/**
 * On-chain times are uint64 seconds; anything past what `Date` can hold would
 * make `Intl` throw and take the page down, so an unrepresentable instant is
 * treated as an absent one.
 */
function toDate(seconds: bigint): Date | null {
  const date = new Date(Number(seconds) * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** A date that holds together on one line: its spaces become same-width no-break spaces. */
function unbroken(date: string): string {
  return date.replace(/ /g, "\u00A0").replace(/\u2009/g, "\u202F");
}

/**
 * A group of the record (the current periods, the finished ones): it opens on
 * the hairline that closes the group above, under an h3 a step above the
 * names of the periods it lists. The garden's own totals head the record
 * without a rule, beside the pool-state sentence.
 */
const GROUP_CLASS = "mt-10 flex flex-col gap-5 border-t border-stroke-soft-200 pt-10";

/**
 * A period's record line in the section's mono voice: type, status, dates.
 * Each part moves to the next line whole. A part wider than the whole line,
 * as Portuguese "Terminou em 13 de jan. de 2026" is on a 320px phone, breaks
 * between its words, and its date holds together (`unbroken`), so a date
 * never splits. A wrapped line never starts or ends on a dot: each dot sits
 * in a gutter before its part, and the line starts one gutter left of a
 * clipping box, as `EditorialMetaRow` does. The dots stay text, so the line
 * still reads "Season · Open now · Runs through …".
 */
function RecordMeta({ parts, className }: { parts: string[]; className?: string }) {
  return (
    <div className={cn("overflow-clip", className)}>
      <p className={`${META_CLASS} -ml-6 flex flex-wrap`}>
        {parts.map((part, index) => (
          <span key={`${index}-${part}`} className="relative pl-6">
            {index > 0 ? <span className="absolute left-0 w-6 text-center">{" · "}</span> : null}
            {part}
          </span>
        ))}
      </p>
    </div>
  );
}

/** The numbers the record's garden totals print above the periods. */
type GardenTotals = {
  made: bigint;
  kept: bigint;
  units: CommitmentUnitSummaryRecord[];
};

/**
 * The current season and campaigns, including periods past their end date
 * that have yet to close. Their units stay with the recorded period. A lone
 * period whose numbers are the garden totals names itself and says so in one
 * line, rather than printing every number a second time (DL-171).
 */
export function OpenCycles({
  cycles,
  units,
  gardenTotals,
}: {
  cycles: PublicCommitmentCycleRecord[];
  units: CommitmentUnitSummaryRecord[];
  gardenTotals: GardenTotals;
}) {
  const { formatMessage } = useIntl();
  // The website has no wallet runtime to read the chain's time from, so the device's clock
  // stands in, as it does for `useExpiryClock` there; it is read as the record opens.
  const [now] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  return (
    <div className={`@container ${GROUP_CLASS}`}>
      <EditorialHeading as="h3" size="sub">
        {formatMessage({
          id: "public.pool.garden.cycles.heading",
          defaultMessage: "Seasons and campaigns",
        })}
      </EditorialHeading>
      <ul className="grid gap-x-12 gap-y-8 @[40rem]:grid-cols-2">
        {cycles.map((cycle) => {
          const cycleUnits = units.filter((unit) => unit.cycleId === cycle.cycleId);
          return (
            <OpenCycle
              key={cycle.id}
              cycle={cycle}
              ended={cycleStanding(cycle, now) === "ended"}
              units={cycleUnits}
              holdsEveryPromise={
                cycles.length === 1 && repeatsGardenTotals(cycle, cycleUnits, gardenTotals)
              }
            />
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Whether a period's own numbers are exactly the garden totals printed above
 * it: the same made and kept counts and the same unit rows. Comparing the
 * numbers, not counting periods, keeps the short form honest: one promise or
 * unit outside the period brings the period's own numbers back.
 */
function repeatsGardenTotals(
  cycle: PublicCommitmentCycleRecord,
  units: CommitmentUnitSummaryRecord[],
  totals: GardenTotals
): boolean {
  return (
    cycle.commitmentsAccepted > 0n &&
    cycle.commitmentsAccepted === totals.made &&
    cycle.commitmentsFulfilled === totals.kept &&
    units.length === totals.units.length &&
    units.every((unit) =>
      totals.units.some(
        (total) =>
          total.unitLabel === unit.unitLabel &&
          total.expectedUnits === unit.expectedUnits &&
          total.fulfilledUnits === unit.fulfilledUnits
      )
    )
  );
}

/**
 * One open cycle: name, type, calm end date, counts, exact-label units. Past its
 * end it reads ended, not open, until a steward closes it (DL-162). Each opens
 * on its own hairline, like a finished row, so its numbers read as its own and
 * never as the garden's totals above. When it holds every promise the garden
 * has made, one line says so in place of its counts and units.
 */
function OpenCycle({
  cycle,
  ended,
  units,
  holdsEveryPromise,
}: {
  cycle: PublicCommitmentCycleRecord;
  ended: boolean;
  units: CommitmentUnitSummaryRecord[];
  holdsEveryPromise: boolean;
}) {
  const intl = useIntl();
  const { formatMessage, formatNumber } = intl;
  const end = cycle.endTime === null ? null : toDate(cycle.endTime);
  const endDate = end ? unbroken(intl.formatDate(end, { dateStyle: "medium" })) : null;
  const meta = [
    cycleTypeLabel(formatMessage, cycle.cycleType),
    ...(ended && endDate
      ? [
          formatMessage(
            { id: "public.pool.garden.cycle.endedOn", defaultMessage: "Ended {date}" },
            { date: endDate }
          ),
        ]
      : [
          formatMessage({ id: "public.pool.garden.cycle.openNow", defaultMessage: "Open now" }),
          ...(endDate
            ? [
                formatMessage(
                  {
                    id: "public.pool.garden.cycle.runsThrough",
                    defaultMessage: "Runs through {date}",
                  },
                  { date: endDate }
                ),
              ]
            : []),
        ]),
  ];
  return (
    <li className="@container flex flex-col gap-3 border-t border-stroke-soft-200 pt-5">
      <div className="flex flex-col gap-1.5">
        {/* The size step is restated with the heading's own leading: a later
            text size drops the size class's leading in `cn`. */}
        <EditorialHeading as="h4" size="sub" className="text-lg leading-[1.18] md:text-xl">
          {cycleName(intl, cycle)}
        </EditorialHeading>
        <RecordMeta parts={meta} />
      </div>
      {holdsEveryPromise ? (
        <p className="text-sm leading-relaxed text-text-sub-600 md:text-base">
          {wholeRecordLine(intl, cycle)}
        </p>
      ) : (
        <>
          {cycle.commitmentsAccepted > 0n ? (
            <p className="text-sm leading-relaxed text-text-sub-600 md:text-base">
              {formatMessage(
                {
                  id: "public.pool.garden.cycle.progress",
                  defaultMessage: "{made} made · {kept} kept so far",
                },
                {
                  made: formatNumber(cycle.commitmentsAccepted),
                  kept: formatNumber(cycle.commitmentsFulfilled),
                }
              )}
            </p>
          ) : null}
          {units.length > 0 ? <UnitRows units={units} /> : null}
        </>
      )}
    </li>
  );
}

/** The line a period that holds every promise prints in place of its numbers. */
function wholeRecordLine(intl: IntlShape, cycle: PublicCommitmentCycleRecord): string {
  const values = {
    count: Number(cycle.commitmentsAccepted),
    made: intl.formatNumber(cycle.commitmentsAccepted),
  };
  return cycle.cycleType === "CAMPAIGN"
    ? intl.formatMessage(
        {
          id: "public.pool.garden.cycle.holdsEveryPromise.campaign",
          defaultMessage:
            "{count, plural, one {The only promise made so far is part of this campaign.} other {All {made} promises so far are part of this campaign.}}",
        },
        values
      )
    : intl.formatMessage(
        {
          id: "public.pool.garden.cycle.holdsEveryPromise.season",
          defaultMessage:
            "{count, plural, one {The only promise made so far is part of this season.} other {All {made} promises so far are part of this season.}}",
        },
        values
      );
}

/**
 * Exact-label unit rows: label on the left, `fulfilled of expected` in mono
 * on the right. Each label keeps its own row and total; hours and rides are
 * never summed into one figure. Rows go two-up only when the containing
 * block is wide enough for both columns to stay legible.
 */
function UnitRows({ units }: { units: CommitmentUnitSummaryRecord[] }) {
  const { formatMessage, formatNumber } = useIntl();
  return (
    <dl
      className="grid grid-cols-1 gap-x-12 @[40rem]:grid-cols-2"
      aria-label={formatMessage({
        id: "public.pool.garden.units.label",
        defaultMessage: "Units by label",
      })}
    >
      {units.map((unit) => (
        <div
          key={unit.id}
          className="flex items-baseline justify-between gap-4 border-t border-stroke-soft-200 py-2.5 text-sm"
        >
          <dt className="truncate text-text-sub-600" title={unit.unitLabel}>
            {unit.unitLabel}
          </dt>
          <dd className="shrink-0 font-mono text-xs tabular-nums text-text-strong-950">
            {formatMessage(
              {
                id: "public.pool.garden.units.progress",
                defaultMessage: "{fulfilled} of {expected}",
              },
              {
                fulfilled: formatNumber(unit.fulfilledUnits),
                expected: formatNumber(unit.expectedUnits),
              }
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Pool-wide exact-label totals, one row per label. */
export function PoolUnits({ units }: { units: CommitmentUnitSummaryRecord[] }) {
  return (
    <div className="@container mt-5">
      <UnitRows units={units} />
    </div>
  );
}

/**
 * Finished cycles newest first, campaigns beside seasons. The rows are the
 * window the reader resolved; `total` counts every finished cycle the Garden
 * has, and `onShowMore` widens the window at the data boundary, so a mature
 * Garden's whole history is never resolved just to show its newest twelve.
 */
export function FinishedCycles({
  cycles,
  total,
  loadingMore,
  onShowMore,
}: {
  cycles: PublicCommitmentCycleRecord[];
  total: number;
  loadingMore: boolean;
  onShowMore: () => void;
}) {
  const intl = useIntl();
  const { formatMessage, formatNumber } = intl;
  const visible = cycles;
  const statusRef = useRef<HTMLParagraphElement>(null);
  const focusPending = useRef(false);

  // When the last page arrives the button unmounts and focus would fall to
  // the document body. Keep the reader on the status line that announces the
  // change instead. Only a click arms this, so a data refresh never steals
  // focus.
  useEffect(() => {
    if (!focusPending.current || loadingMore) return;
    focusPending.current = false;
    if (visible.length >= total) statusRef.current?.focus();
  }, [visible.length, total, loadingMore]);

  return (
    <div className={`@container ${GROUP_CLASS}`}>
      <EditorialHeading as="h3" size="sub">
        {formatMessage({
          id: "public.pool.garden.history.kicker",
          defaultMessage: "Finished seasons and campaigns",
        })}
      </EditorialHeading>
      {/* Rows share the list's columns (subgrid), so every row's dates and
          counts start on the same line. Narrow, the record line drops under
          the name; wide, it sits beside its counts with the name taking the
          slack. Before Chrome 117 (no subgrid), each row inherits the list's
          columns and gaps instead and loses only that shared line. */}
      <ul className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 divide-y divide-stroke-soft-200 border-y border-stroke-soft-200 @[48rem]:grid-cols-[minmax(0,1fr)_auto_auto] @[48rem]:gap-x-10">
        {visible.map((cycle) => (
          <li
            key={cycle.id}
            className="col-span-full grid grid-cols-subgrid items-baseline gap-y-1 py-3 not-supports-[grid-template-columns:subgrid]:grid-cols-[inherit] not-supports-[grid-template-columns:subgrid]:gap-x-[inherit]"
          >
            <p
              className="truncate font-serif text-base text-text-strong-950 md:text-lg"
              title={cycleName(intl, cycle)}
            >
              {cycleName(intl, cycle)}
            </p>
            <RecordMeta
              className="order-last col-span-full @[48rem]:order-none @[48rem]:col-span-1"
              parts={[
                cycleTypeLabel(formatMessage, cycle.cycleType),
                cycle.state === "COMPOSTED"
                  ? formatMessage({
                      id: "public.pool.garden.cycle.archived",
                      defaultMessage: "Archived",
                    })
                  : formatMessage({
                      id: "public.pool.garden.cycle.closed",
                      defaultMessage: "Closed",
                    }),
                cycleWindow(intl, cycle),
              ]}
            />
            <p className="justify-self-end font-mono text-xs tabular-nums text-text-sub-600">
              {formatMessage(
                {
                  id: "public.pool.garden.history.keptOfMade",
                  defaultMessage: "{kept} of {made} kept",
                },
                {
                  kept: formatNumber(cycle.commitmentsFulfilled),
                  made: formatNumber(cycle.commitmentsAccepted),
                }
              )}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4">
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={`${META_CLASS} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2`}
        >
          {formatMessage(
            {
              id: "public.pool.garden.history.showing",
              defaultMessage: "Showing {shown} of {total}",
            },
            { shown: visible.length, total }
          )}
        </p>
        {visible.length < total ? (
          <Button
            type="button"
            emphasis="tertiary"
            loading={loadingMore}
            onClick={() => {
              focusPending.current = true;
              onShowMore();
            }}
          >
            {formatMessage({
              id: "public.pool.garden.history.loadMore",
              defaultMessage: "Show More Seasons",
            })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The panel's closing line: fulfilled commitments are anchored in § 03
 * Certificates further down the page. A plain hash link, not the router
 * `EditorialLinkArrow`, because the target is on this page.
 */
export function CertificatesTieIn() {
  const { formatMessage } = useIntl();
  return (
    <div className="mt-10 flex flex-col gap-4 border-t border-stroke-soft-200 pt-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
      <p className="font-serif text-base italic leading-[1.55] text-text-sub-600 md:text-lg">
        {formatMessage({
          id: "public.pool.garden.certificatesTieIn",
          defaultMessage:
            "Fulfilled promises from these seasons are anchored in the certificates below.",
        })}
      </p>
      <a href="#public-garden-detail-certificates" className={ARROW_LINK_CLASS}>
        {formatMessage({
          id: "public.pool.garden.certificatesLink",
          defaultMessage: "See the Certificates",
        })}
        <span
          aria-hidden="true"
          className="transition-transform duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1"
        >
          →
        </span>
      </a>
    </div>
  );
}

function cycleWindow(intl: IntlShape, cycle: PublicCommitmentCycleRecord): string {
  const format = { month: "short", year: "numeric" } as const;
  const start = cycle.startTime === null ? null : toDate(cycle.startTime);
  const end = cycle.endTime === null ? null : toDate(cycle.endTime);
  if (start && end) return unbroken(intl.formatDateTimeRange(start, end, format));
  const single = end ?? start;
  return single
    ? unbroken(intl.formatDate(single, format))
    : intl.formatMessage({
        id: "public.pool.garden.history.datesUnavailable",
        defaultMessage: "Dates not available",
      });
}
