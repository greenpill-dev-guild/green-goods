import { type ChangeEvent, useCallback, useMemo } from "react";
import type { ConvictionAllocations } from "../../types/conviction";
import { cn } from "../../utils/styles/cn";

export interface WeightAllocatorProposal {
  id: string;
  title: string;
}

export interface WeightAllocatorProps {
  proposals: WeightAllocatorProposal[];
  /** Map of proposal id → allocated percent (0–100). */
  allocations: ConvictionAllocations;
  /**
   * Fired on every slider/input change with the next allocations object.
   * The consumer is responsible for debouncing the server save (the
   * recommended cadence is 300–500ms — per design_handoff README § 9).
   */
  onChange: (next: ConvictionAllocations) => void;
  /** Disable all interactions (read-only view). */
  disabled?: boolean;
  className?: string;
}

const TOTAL_BUDGET = 100;

function sumAllocations(allocations: ConvictionAllocations): number {
  let total = 0;
  for (const value of Object.values(allocations)) {
    if (Number.isFinite(value)) total += value;
  }
  return total;
}

function clampAllocation(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(TOTAL_BUDGET, Math.max(0, Math.round(value)));
}

/**
 * WeightAllocator — list of proposals with sliders that sum to ≤100%.
 *
 * Per audit §5.4.1 the allocator lands inline at the top of Community →
 * Governance in the first delivery (recommendation accepted). Long lists
 * become a Tier-4 question; this component renders whatever it is given.
 *
 * Spec: design_handoff_admin-revamp/screens/UI%20Review.html § 03 +
 * design_handoff_admin-revamp/README.md § 7.
 */
export function WeightAllocator({
  proposals,
  allocations,
  onChange,
  disabled = false,
  className,
}: WeightAllocatorProps) {
  const total = useMemo(() => sumAllocations(allocations), [allocations]);
  const remaining = TOTAL_BUDGET - total;
  const isOverBudget = total > TOTAL_BUDGET;

  const handleChange = useCallback(
    (id: string, nextValue: number) => {
      const next = { ...allocations, [id]: clampAllocation(nextValue) };
      onChange(next);
    },
    [allocations, onChange]
  );

  return (
    <div
      data-component="WeightAllocator"
      data-over-budget={isOverBudget ? "true" : "false"}
      className={cn(
        "flex flex-col gap-3 rounded-[var(--r-lg,16px)] p-4",
        "bg-[var(--surface-raised,rgb(var(--bg-white-0)))] shadow-[var(--e2)]",
        disabled && "opacity-60",
        className
      )}
    >
      <header className="flex items-baseline justify-between">
        <h3 className="text-title-md font-semibold text-text-strong">My voting weight</h3>
        <p
          className={cn(
            "text-label-md font-medium tabular-nums",
            isOverBudget ? "text-error-dark" : "text-text-sub"
          )}
          aria-live="polite"
        >
          <span aria-label={`${total} percent of ${TOTAL_BUDGET} percent allocated`}>
            {total} / {TOTAL_BUDGET}%
          </span>
          {!isOverBudget && remaining > 0 ? (
            <span className="ml-1 text-text-soft">({remaining}% free)</span>
          ) : null}
          {isOverBudget ? (
            <span className="ml-1 text-error-dark">(over by {total - TOTAL_BUDGET}%)</span>
          ) : null}
        </p>
      </header>

      <ul className="flex flex-col gap-3" data-slot="proposal-list">
        {proposals.map((proposal) => {
          const value = clampAllocation(allocations[proposal.id] ?? 0);
          return (
            <AllocatorRow
              key={proposal.id}
              proposal={proposal}
              value={value}
              disabled={disabled}
              onChange={(nextValue) => handleChange(proposal.id, nextValue)}
            />
          );
        })}
      </ul>
    </div>
  );
}

interface AllocatorRowProps {
  proposal: WeightAllocatorProposal;
  value: number;
  disabled: boolean;
  onChange: (next: number) => void;
}

function AllocatorRow({ proposal, value, disabled, onChange }: AllocatorRowProps) {
  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };

  return (
    <li data-slot="allocator-row" data-proposal-id={proposal.id} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span
          className="min-w-0 flex-1 truncate text-label-md font-medium text-text-strong"
          title={proposal.title}
        >
          {proposal.title}
        </span>
        <label className="inline-flex items-center gap-1 text-label-sm font-medium text-text-sub">
          <input
            type="number"
            min={0}
            max={TOTAL_BUDGET}
            step={1}
            value={value}
            disabled={disabled}
            onChange={handleInputChange}
            className={cn(
              "h-8 w-16 rounded-[var(--r-sm,8px)] px-2 text-right tabular-nums",
              "border border-[rgb(var(--stroke-sub-300))] bg-[rgb(var(--bg-white-0))]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-action))]"
            )}
            aria-label={`${proposal.title} weight, percent`}
          />
          <span aria-hidden="true">%</span>
        </label>
      </div>
      <input
        type="range"
        min={0}
        max={TOTAL_BUDGET}
        step={1}
        value={value}
        disabled={disabled}
        onChange={handleSliderChange}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full",
          "bg-[rgb(var(--neutral-200))]",
          "accent-[rgb(var(--primary-action))]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-action))]"
        )}
        aria-label={`${proposal.title} weight slider`}
      />
    </li>
  );
}
