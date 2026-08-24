import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  type CommitmentUnitSummaryRecord,
  type PublicCommitmentCycleRecord,
} from "@green-goods/shared/commitment-pooling";
import { useEffect, useRef } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { EditorialHeading, EditorialKicker } from "@/components/Public/atoms";

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

/**
 * The open Season and every open Campaign. The block sizes itself to the
 * panel cell it lands in: one column beside the pool units, two across when
 * it has the whole width.
 */
export function OpenCycles({
  cycles,
  units,
  className,
}: {
  cycles: PublicCommitmentCycleRecord[];
  units: CommitmentUnitSummaryRecord[];
  className?: string;
}) {
  const { formatMessage } = useIntl();
  return (
    <div className={cn("@container flex flex-col gap-4", className)}>
      <EditorialKicker>
        {formatMessage({ id: "public.pool.garden.openKicker", defaultMessage: "In progress" })}
      </EditorialKicker>
      <ul className="grid gap-8 @[40rem]:grid-cols-2">
        {cycles.map((cycle) => (
          <OpenCycle
            key={cycle.id}
            cycle={cycle}
            units={units.filter((unit) => unit.cycleId === cycle.cycleId)}
          />
        ))}
      </ul>
    </div>
  );
}

/** One open cycle: name, type, calm end date, counts, exact-label units. */
function OpenCycle({
  cycle,
  units,
}: {
  cycle: PublicCommitmentCycleRecord;
  units: CommitmentUnitSummaryRecord[];
}) {
  const intl = useIntl();
  const { formatMessage, formatNumber } = intl;
  const end = cycle.endTime === null ? null : toDate(cycle.endTime);
  const meta = [
    cycleTypeLabel(formatMessage, cycle.cycleType),
    formatMessage({ id: "public.pool.garden.cycle.openNow", defaultMessage: "Open now" }),
    ...(end
      ? [
          formatMessage(
            { id: "public.pool.garden.cycle.runsThrough", defaultMessage: "Runs through {date}" },
            { date: intl.formatDate(end, { dateStyle: "medium" }) }
          ),
        ]
      : []),
  ];
  return (
    <li className="@container flex flex-col gap-3">
      <EditorialHeading as="h3" size="sub">
        {cycleName(intl, cycle)}
      </EditorialHeading>
      <p className={META_CLASS}>{meta.join(" · ")}</p>
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
    </li>
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
export function PoolUnits({
  units,
  className,
}: {
  units: CommitmentUnitSummaryRecord[];
  className?: string;
}) {
  const { formatMessage } = useIntl();
  return (
    <div className={cn("@container flex flex-col gap-4", className)}>
      <EditorialKicker>
        {formatMessage({
          id: "public.pool.garden.units.pool",
          defaultMessage: "Across the whole pool",
        })}
      </EditorialKicker>
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
    <div className="mt-8 flex flex-col gap-4 border-t border-stroke-soft-200 pt-8">
      <EditorialKicker>
        {formatMessage({
          id: "public.pool.garden.history.kicker",
          defaultMessage: "Finished seasons and campaigns",
        })}
      </EditorialKicker>
      <ul className="flex flex-col divide-y divide-stroke-soft-200 border-y border-stroke-soft-200">
        {visible.map((cycle) => (
          <li
            key={cycle.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:gap-x-10"
          >
            <p
              className="truncate font-serif text-base text-text-strong-950 md:text-lg"
              title={cycleName(intl, cycle)}
            >
              {cycleName(intl, cycle)}
            </p>
            <p className={`${META_CLASS} order-last col-span-2 md:order-none md:col-span-1`}>
              {cycleTypeLabel(formatMessage, cycle.cycleType)} · {cycleWindow(intl, cycle)}
            </p>
            <p className="shrink-0 justify-self-end font-mono text-xs tabular-nums text-text-sub-600">
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
          <button
            type="button"
            disabled={loadingMore}
            aria-busy={loadingMore}
            onClick={() => {
              focusPending.current = true;
              onShowMore();
            }}
            className="border-b border-primary-action/35 pb-0.5 text-sm font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 disabled:cursor-wait disabled:text-text-soft-400"
          >
            {formatMessage({
              id: "public.pool.garden.history.loadMore",
              defaultMessage: "Show more seasons",
            })}
          </button>
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
    <div className="mt-8 flex flex-col gap-4 border-t border-stroke-soft-200 pt-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
      <p className="font-serif text-base italic leading-[1.55] text-text-sub-600 md:text-lg">
        {formatMessage({
          id: "public.pool.garden.certificatesTieIn",
          defaultMessage:
            "Fulfilled commitments from these seasons are anchored in the certificates below.",
        })}
      </p>
      <a href="#public-garden-detail-certificates" className={ARROW_LINK_CLASS}>
        {formatMessage({
          id: "public.pool.garden.certificatesLink",
          defaultMessage: "See the certificates",
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
  if (start && end) return intl.formatDateTimeRange(start, end, format);
  const single = end ?? start;
  return single
    ? intl.formatDate(single, format)
    : intl.formatMessage({
        id: "public.pool.garden.history.datesUnavailable",
        defaultMessage: "Dates not available",
      });
}
