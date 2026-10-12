import { IconButton } from "@green-goods/shared/components/IconButton";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  type CommitmentCycleRecord,
  useCommitmentCycleNames,
} from "@green-goods/shared/commitment-pooling";
import { RiCheckboxCircleFill, RiFlagLine, RiInformationLine, RiSunLine } from "@remixicon/react";
import { type IntlShape, useIntl } from "react-intl";

export interface CycleRailProps {
  cycles: CommitmentCycleRecord[];
  selectedCycleId: bigint | null;
  onSelect: (cycleId: bigint | null) => void;
  /** Opens a season's or campaign's details, from the ⓘ on its card. */
  onShowDetails?: (cycle: CommitmentCycleRecord) => void;
}

/**
 * How a season or a campaign is told apart (D15): seasons amber and campaigns
 * sky, the two supporting accents, on the warning and information tokens. The
 * glyph and the word stay, so colour is never the only cue.
 */
const CYCLE_KIND_TONE = {
  season: { tile: "bg-warning-lighter text-warning-dark", word: "text-warning-dark" },
  campaign: { tile: "bg-information-lighter text-information-dark", word: "text-information-dark" },
} as const;

/** The dates a cycle runs, with the year only where it helps, or null when either end is unset. */
export function cycleDates(
  intl: IntlShape,
  cycle: CommitmentCycleRecord,
  { withYear }: { withYear: boolean }
): string | null {
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
  const endLabel = intl.formatDate(end, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
  // A single-day campaign is one date, never "Apr 12 – Apr 12".
  if (start.toDateString() === end.toDateString()) return endLabel;
  const startLabel = intl.formatDate(start, {
    month: "short",
    day: "numeric",
    ...(start.getFullYear() !== end.getFullYear() ? { year: "numeric" } : {}),
  });
  return intl.formatMessage({ id: "app.pool.rail.dates" }, { start: startLabel, end: endLabel });
}

/** The season or campaign identity: its glyph on a round tile, its kind in its colour, its state. */
export function CycleIdentity({ cycle }: { cycle: CommitmentCycleRecord }) {
  const { formatMessage } = useIntl();
  const isCampaign = cycle.cycleType === "CAMPAIGN";
  const tone = CYCLE_KIND_TONE[isCampaign ? "campaign" : "season"];
  const state = (cycle.state ?? "UNKNOWN").toLowerCase();
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full", tone.tile)}
        aria-hidden="true"
      >
        {isCampaign ? (
          <RiFlagLine className="h-3.5 w-3.5" />
        ) : (
          <RiSunLine className="h-3.5 w-3.5" />
        )}
      </span>
      <span className={cn("text-xs font-semibold", tone.word)}>
        {formatMessage({ id: isCampaign ? "app.pool.rail.campaign" : "app.pool.rail.season" })}
      </span>
      <StatusBadge
        size="xs"
        variant={state === "open" ? "success" : "neutral"}
        showIcon={false}
        className="shrink-0 whitespace-nowrap"
      >
        {formatMessage({ id: `app.pool.cycleState.${state}` })}
      </StatusBadge>
    </span>
  );
}

/**
 * The seasons and campaigns a pool is running, as a horizontal rail.
 *
 * Tapping a card shows only its promises, and tapping it again shows all; its
 * ⓘ opens the season's or campaign's details (D5). Each card carries its own
 * scope's counts, never summed across cards: a season and a campaign measure
 * different things, and adding them would invent a number the garden never
 * agreed to.
 *
 * One cycle is one card at full width, since a track with nothing beside it
 * only clips the card. Two or more ride the rail.
 */
export function CycleRail({ cycles, selectedCycleId, onSelect, onShowDetails }: CycleRailProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { byCycleId } = useCommitmentCycleNames(cycles);

  if (cycles.length === 0) return null;

  const single = cycles.length === 1;
  const cards = cycles.map((cycle) => {
    const isCampaign = cycle.cycleType === "CAMPAIGN";
    const selected = selectedCycleId === cycle.cycleId;
    const kindLabel = formatMessage({
      id: isCampaign ? "app.pool.rail.campaign" : "app.pool.rail.season",
    });
    const name = byCycleId.get(cycle.cycleId.toString())?.name ?? null;
    const label = name ?? kindLabel;
    const dates = cycleDates(intl, cycle, { withYear: false });
    const counts = formatMessage(
      { id: "app.pool.rail.counts" },
      { kept: Number(cycle.commitmentsFulfilled), made: Number(cycle.commitmentsDue) }
    );

    return (
      <div
        key={cycle.id}
        className={cn("relative", single ? "w-full" : "min-w-[13rem] shrink-0 snap-start")}
      >
        <button
          type="button"
          data-pressable="card"
          aria-pressed={selected}
          aria-label={formatMessage(
            { id: selected ? "app.pool.rail.showing" : "app.pool.rail.show" },
            { name: label }
          )}
          onClick={() => onSelect(selected ? null : cycle.cycleId)}
          className={cn(
            "w-full rounded-[var(--radius-lg)] border p-3 text-left",
            onShowDetails && "pe-12",
            selected
              ? "border-primary-on-surface bg-primary-alpha-10"
              : "border-stroke-soft-200 bg-bg-white-0"
          )}
        >
          <CycleIdentity cycle={cycle} />
          <span className="mt-2 flex min-w-0 items-center gap-1.5">
            {selected ? (
              <RiCheckboxCircleFill
                className="h-4 w-4 shrink-0 text-primary-on-surface"
                aria-hidden="true"
              />
            ) : null}
            <span className="block truncate text-sm font-medium text-text-strong-950" title={label}>
              {label}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-text-sub-600">
            {dates
              ? formatMessage({ id: "app.pool.rail.datesAndCounts" }, { dates, counts })
              : counts}
          </span>
        </button>
        {/* A sibling of the card, never inside it: a button cannot hold a button. */}
        {onShowDetails ? (
          <IconButton
            emphasis="tertiary"
            size="compact"
            onClick={() => onShowDetails(cycle)}
            aria-label={formatMessage({ id: "app.pool.rail.about" }, { name: label })}
            title={formatMessage({ id: "app.pool.rail.about" }, { name: label })}
            icon={<RiInformationLine className="h-4 w-4" aria-hidden="true" />}
            className="absolute end-2 top-2"
          />
        ) : null}
      </div>
    );
  });

  if (single) return cards[0];
  return (
    <div
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scroll-px-4"
      role="group"
      aria-label={formatMessage({ id: "app.pool.rail.label" })}
    >
      {cards}
    </div>
  );
}
