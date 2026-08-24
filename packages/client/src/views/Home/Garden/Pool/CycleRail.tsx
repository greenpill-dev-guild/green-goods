import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  type CommitmentCycleRecord,
  useCommitmentCycleNames,
} from "@green-goods/shared/commitment-pooling";
import { RiFlagLine, RiSunLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface CycleRailProps {
  cycles: CommitmentCycleRecord[];
  selectedCycleId: bigint | null;
  onSelect: (cycleId: bigint | null) => void;
}

/**
 * The seasons and campaigns a pool is running, as a horizontal rail.
 *
 * Season and campaign are told apart by their own word and their own glyph,
 * never by colour alone. The prototype gives this rail a dedicated identity
 * colour that has no canonical token yet, and improvising a hex here would put
 * an unreviewed value into the app, so the rail ships on the existing neutral
 * and accent roles until that decision lands.
 *
 * Each slide carries its own scope's counts. They are never summed across
 * slides: a season and a campaign measure different things, and adding them
 * would invent a number the garden never agreed to.
 */
export function CycleRail({ cycles, selectedCycleId, onSelect }: CycleRailProps) {
  const { formatMessage, formatDate } = useIntl();
  const { byCycleId } = useCommitmentCycleNames(cycles);

  if (cycles.length === 0) return null;

  // A calm date: the day it runs from and the day it runs to. Seconds on the
  // record, so the conversion happens once here rather than in the template.
  const calmRange = (cycle: CommitmentCycleRecord) => {
    if (
      cycle.startTime === null ||
      cycle.startTime === undefined ||
      cycle.endTime === null ||
      cycle.endTime === undefined
    ) {
      return null;
    }
    const start = new Date(Number(cycle.startTime) * 1000);
    const end = new Date(Number(cycle.endTime) * 1000);
    const startLabel = formatDate(start, {
      month: "short",
      day: "numeric",
      ...(start.getFullYear() !== end.getFullYear() ? { year: "numeric" } : {}),
    });
    const endLabel = formatDate(end, { month: "short", day: "numeric", year: "numeric" });
    return formatMessage({ id: "app.pool.rail.dates" }, { start: startLabel, end: endLabel });
  };

  return (
    <div
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1"
      role="group"
      aria-label={formatMessage({ id: "app.pool.rail.label" })}
    >
      {cycles.map((cycle) => {
        const isCampaign = cycle.cycleType === "CAMPAIGN";
        const selected = selectedCycleId === cycle.cycleId;
        const kindLabel = formatMessage({
          id: isCampaign ? "app.pool.rail.campaign" : "app.pool.rail.season",
        });
        const stateLabel = formatMessage({
          id: `app.pool.cycleState.${(cycle.state ?? "UNKNOWN").toLowerCase()}`,
        });
        const name = byCycleId.get(cycle.cycleId.toString())?.name ?? null;
        const dates = calmRange(cycle);

        return (
          <button
            key={cycle.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(selected ? null : cycle.cycleId)}
            className={cn(
              "min-w-[13rem] shrink-0 snap-start rounded-[var(--radius-lg)] border p-3 text-left tap-feedback",
              selected
                ? "border-primary-alpha-24 bg-primary-alpha-10"
                : "border-stroke-soft-200 bg-bg-white-0"
            )}
          >
            {/* Chips lead, then the name, then the calm date, then the counts,
              all on one left axis. */}
            <span className="flex items-center gap-1.5 text-xs font-medium text-text-sub-600">
              {isCampaign ? (
                <RiFlagLine className="h-4 w-4" aria-hidden="true" />
              ) : (
                <RiSunLine className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{kindLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{stateLabel}</span>
            </span>
            {name ? (
              <span
                className="mt-1 block truncate text-sm font-medium text-text-strong-950"
                title={name}
              >
                {name}
              </span>
            ) : null}
            {dates ? <span className="mt-1 block text-xs text-text-sub-600">{dates}</span> : null}
            <span className="mt-1 block text-xs text-text-sub-600">
              {formatMessage(
                { id: "app.pool.rail.counts" },
                {
                  kept: Number(cycle.commitmentsFulfilled),
                  made: Number(cycle.commitmentsDue),
                }
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
