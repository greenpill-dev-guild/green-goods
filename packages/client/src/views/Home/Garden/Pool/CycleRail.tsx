import { cn, type CommitmentCycleRecord } from "@green-goods/shared";
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
  const { formatMessage } = useIntl();

  if (cycles.length === 0) return null;

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
            <span className="flex items-center gap-1.5 text-xs font-medium text-text-sub-600">
              {isCampaign ? (
                <RiFlagLine className="h-4 w-4" aria-hidden="true" />
              ) : (
                <RiSunLine className="h-4 w-4" aria-hidden="true" />
              )}
              {kindLabel}
            </span>
            <span className="mt-1 block text-sm font-medium text-text-strong-950">
              {stateLabel}
            </span>
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
