import type { CommitmentUnitSummaryRecord, PublicCommitmentCycleRecord } from "@green-goods/shared";
import { useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { EditorialKicker } from "@/components/Public/atoms";

/**
 * Cycle rows for the public Garden page's `§ 02 Commitments` section: the
 * open Season and Campaigns, exact-label unit rows, and the finished-cycle
 * history. Split out of `GardenDetailCommitments.tsx` to keep that file under
 * the source-structure ceiling; they have no meaning outside it.
 */

/** Finished-cycle window, paged locally like § 01 field notes. */
const HISTORY_PAGE_SIZE = 12;

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

function toDate(seconds: bigint): Date {
  return new Date(Number(seconds) * 1000);
}

/** The current chapter: name, type, calm end date, counts, exact-label units. */
export function OpenCycle({
  cycle,
  units,
}: {
  cycle: PublicCommitmentCycleRecord;
  units: CommitmentUnitSummaryRecord[];
}) {
  const intl = useIntl();
  const { formatMessage, formatNumber } = intl;
  const meta = [
    cycleTypeLabel(formatMessage, cycle.cycleType),
    formatMessage({ id: "public.pool.garden.cycle.openNow", defaultMessage: "Open now" }),
    ...(cycle.endTime !== null
      ? [
          formatMessage(
            { id: "public.pool.garden.cycle.runsThrough", defaultMessage: "Runs through {date}" },
            { date: intl.formatDate(toDate(cycle.endTime), { dateStyle: "medium" }) }
          ),
        ]
      : []),
  ];
  return (
    <li className="border-t border-stroke-soft-200 pt-6">
      <h3 className="font-serif text-xl text-text-strong-950">{cycleName(intl, cycle)}</h3>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
        {meta.join(" · ")}
      </p>
      {cycle.commitmentsAccepted > 0n ? (
        <p className="mt-3 text-sm text-text-sub-600">
          {formatMessage(
            {
              id: "public.pool.garden.cycle.progress",
              defaultMessage: "{made} made · {kept} kept so far",
            },
            {
              made: formatNumber(Number(cycle.commitmentsAccepted)),
              kept: formatNumber(Number(cycle.commitmentsFulfilled)),
            }
          )}
        </p>
      ) : null}
      {units.length > 0 ? <UnitRows units={units} /> : null}
    </li>
  );
}

/**
 * Exact-label unit rows. Each label keeps its own row and total; hours and
 * rides are never summed into one figure.
 */
export function UnitRows({ units }: { units: CommitmentUnitSummaryRecord[] }) {
  const { formatMessage, formatNumber } = useIntl();
  return (
    <dl
      className="mt-4 flex max-w-md flex-col divide-y divide-stroke-soft-200"
      aria-label={formatMessage({
        id: "public.pool.garden.units.label",
        defaultMessage: "Units by label",
      })}
    >
      {units.map((unit) => (
        <div key={unit.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
          <dt className="truncate text-text-strong-950" title={unit.unitLabel}>
            {unit.unitLabel}
          </dt>
          <dd className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage(
              {
                id: "public.pool.garden.units.progress",
                defaultMessage: "{fulfilled} of {expected}",
              },
              {
                fulfilled: formatNumber(Number(unit.fulfilledUnits)),
                expected: formatNumber(Number(unit.expectedUnits)),
              }
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Finished cycles newest first, twelve at a time, campaigns beside seasons. */
export function FinishedCycles({ cycles }: { cycles: PublicCommitmentCycleRecord[] }) {
  const intl = useIntl();
  const { formatMessage, formatNumber } = intl;
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const visible = cycles.slice(0, visibleCount);

  return (
    <div className="mt-10">
      <EditorialKicker>
        {formatMessage({
          id: "public.pool.garden.history.kicker",
          defaultMessage: "Finished seasons and campaigns",
        })}
      </EditorialKicker>
      <ul className="mt-4 flex flex-col divide-y divide-stroke-soft-200 border-y border-stroke-soft-200">
        {visible.map((cycle) => (
          <li key={cycle.id} className="flex items-baseline justify-between gap-4 py-3">
            <div className="min-w-0">
              <p
                className="truncate font-serif text-base text-text-strong-950"
                title={cycleName(intl, cycle)}
              >
                {cycleName(intl, cycle)}
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
                {cycleTypeLabel(formatMessage, cycle.cycleType)} · {cycleWindow(intl, cycle)}
              </p>
            </div>
            <p className="shrink-0 text-sm text-text-sub-600">
              {formatMessage(
                {
                  id: "public.pool.garden.history.keptOfMade",
                  defaultMessage: "{kept} of {made} kept",
                },
                {
                  kept: formatNumber(Number(cycle.commitmentsFulfilled)),
                  made: formatNumber(Number(cycle.commitmentsAccepted)),
                }
              )}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <p
          role="status"
          aria-live="polite"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage(
            {
              id: "public.pool.garden.history.showing",
              defaultMessage: "Showing {shown} of {total}",
            },
            { shown: visible.length, total: cycles.length }
          )}
        </p>
        {visible.length < cycles.length ? (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}
            className="border-b border-primary-action/35 pb-0.5 text-sm font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
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

function cycleWindow(intl: IntlShape, cycle: PublicCommitmentCycleRecord): string {
  const format = { month: "short", year: "numeric" } as const;
  if (cycle.startTime !== null && cycle.endTime !== null) {
    return intl.formatDateTimeRange(toDate(cycle.startTime), toDate(cycle.endTime), format);
  }
  const single = cycle.endTime ?? cycle.startTime;
  return single !== null
    ? intl.formatDate(toDate(single), format)
    : intl.formatMessage({
        id: "public.pool.garden.history.datesUnavailable",
        defaultMessage: "Dates not available",
      });
}
