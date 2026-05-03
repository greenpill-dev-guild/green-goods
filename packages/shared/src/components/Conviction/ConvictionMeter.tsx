import { type CSSProperties, useId } from "react";
import type { ConvictionProposalStatus } from "../../types/conviction";
import { cn } from "../../utils/styles/cn";

export interface ConvictionMeterProps {
  /** Current accrued conviction (0–100). */
  conviction: number;
  /** Conviction threshold (0–100). */
  threshold: number;
  /** Daily accrual rate in percent at the proposal's current weight. */
  dailyAccrual: number;
  /**
   * Lifecycle state. When "funded" or "expired" the meter hides the ETA copy
   * (the outcome is already resolved). When "withdrawn" the ETA shows the
   * decay direction. Optional — pure conviction/threshold rendering works
   * without it.
   */
  status?: ConvictionProposalStatus;
  /** Render the accrual + ETA labels under the bar. Default true. */
  showLabels?: boolean;
  className?: string;
}

const PULSE_THRESHOLD_RANGE = 5;

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function formatAccrualRate(dailyAccrual: number): string {
  if (dailyAccrual <= 0) return "no accrual";
  const sign = dailyAccrual >= 0 ? "+" : "";
  return `${sign}${dailyAccrual.toFixed(1)}% / day`;
}

function formatETA(
  conviction: number,
  threshold: number,
  dailyAccrual: number,
  status?: ConvictionProposalStatus
): string {
  if (status === "funded") return "funded";
  if (status === "expired") return "expired";
  if (status === "withdrawn") return "decaying";
  if (conviction >= threshold) return "passing";
  if (dailyAccrual <= 0) return "stalled";

  const days = (threshold - conviction) / dailyAccrual;
  if (days < 1) return "< 1 day to threshold";
  if (days < 1.5) return "1 day to threshold";
  return `${Math.round(days)} days to threshold`;
}

/**
 * ConvictionMeter — single-bar accrual visualisation with threshold tick,
 * accrual rate, and ETA. No decay UI fidelity in v1 per audit §5.4.2 — Tier 3
 * recommendation was to ship without ghost trailing fill.
 *
 * Spec: design_handoff_admin-revamp/screens/UI%20Review.html § 03 +
 * DESIGN_NOTES.md § "Conviction voting".
 */
export function ConvictionMeter({
  conviction,
  threshold,
  dailyAccrual,
  status,
  showLabels = true,
  className,
}: ConvictionMeterProps) {
  const safeConviction = clampPercent(conviction);
  const safeThreshold = clampPercent(threshold);
  const isPassing = safeConviction >= safeThreshold;
  const distanceToThreshold = Math.abs(safeConviction - safeThreshold);
  const isNearThreshold =
    !isPassing && distanceToThreshold <= PULSE_THRESHOLD_RANGE && dailyAccrual > 0;

  const meterId = useId();
  const accrualLabel = formatAccrualRate(dailyAccrual);
  const etaLabel = formatETA(safeConviction, safeThreshold, dailyAccrual, status);

  const fillStyle: CSSProperties = {
    width: `${safeConviction}%`,
    background: "var(--g-action, rgb(var(--primary-action)))",
    transition:
      "width var(--spring-spatial-slow-duration, 600ms) var(--spring-spatial-slow-easing, cubic-bezier(0.16, 1, 0.3, 1))",
  };

  const tickStyle: CSSProperties = {
    left: `${safeThreshold}%`,
  };

  return (
    <div
      data-component="ConvictionMeter"
      data-status={status ?? "accruing"}
      data-passing={isPassing ? "true" : "false"}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <div
        role="progressbar"
        aria-valuenow={Math.round(safeConviction)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${Math.round(safeConviction)}% of ${Math.round(safeThreshold)}% threshold`}
        aria-labelledby={`${meterId}-label`}
        className={cn(
          "relative h-1.5 w-full overflow-visible rounded-full",
          "bg-[rgb(var(--neutral-200))]"
        )}
      >
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-full"
          style={fillStyle}
          data-slot="fill"
        />
        <span
          aria-hidden="true"
          data-slot="threshold-tick"
          data-near-threshold={isNearThreshold ? "true" : "false"}
          className={cn(
            "absolute -top-1 h-3.5 w-[2px] -translate-x-1/2 rounded-full",
            "bg-[rgb(var(--neutral-700))]",
            isNearThreshold && "animate-pulse"
          )}
          style={tickStyle}
        />
      </div>

      {showLabels ? (
        <div
          id={`${meterId}-label`}
          className="flex items-center justify-between gap-2 text-label-sm font-medium tabular-nums"
        >
          <span className="text-text-sub">{accrualLabel}</span>
          <span
            className={cn(
              "text-text-soft",
              isPassing && "text-success-dark",
              status === "expired" && "text-error-dark"
            )}
          >
            {etaLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}
