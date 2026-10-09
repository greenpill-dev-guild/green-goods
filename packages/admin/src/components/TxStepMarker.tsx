import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckLine, RiCloseLine, RiLoader4Line, RiTimeLine } from "@remixicon/react";

/** Where one step of an on-chain act stands. */
export type TxStepMarkerState = "pending" | "active" | "complete" | "queued" | "failed" | "warning";

export interface TxStepMarkerProps {
  state: TxStepMarkerState;
  /** Shown while the step is still to come: its number, or the wallet prompt it rides in. */
  label?: string | number;
  size?: "md" | "sm";
}

/**
 * The circle beside one step of an on-chain act: a number while it waits, a
 * spinner while it runs, a check once the chain shows it, a clock where it
 * was left to send later, a cross where it stopped. One atom for every
 * multi-step signature surface (minting a hypercert, setting up a pool,
 * seeding commitments), so a steward reads progress the same way everywhere.
 * Decorative: the step's own text carries its state for screen readers.
 */
export function TxStepMarker({ state, label, size = "md" }: TxStepMarkerProps) {
  const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span
      data-component="TxStepMarker"
      data-state={state}
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 font-medium transition-all",
        size === "md" ? "h-8 w-8 body-sm" : "h-6 w-6 body-xs",
        // Done and running follow the admin step dot (ActionFlowStepper): the
        // workspace action fill with its paired foreground (the darker action
        // role DESIGN.md sets for step markers), and a tinted ring while it runs.
        state === "complete" &&
          "border-[rgb(var(--tone-action,var(--primary-action)))] bg-[rgb(var(--tone-action,var(--primary-action)))] [color:rgb(var(--tone-on-action,var(--primary-action-foreground)))]",
        state === "active" &&
          "border-[rgb(var(--tone-action,var(--primary-action)))] bg-[rgb(var(--tone-action,var(--primary-action))/0.1)] text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]",
        state === "queued" && "border-warning-dark bg-warning-lighter text-warning-dark",
        state === "failed" && "border-error-dark bg-error-lighter text-error-dark",
        state === "warning" && "border-warning-dark bg-warning-lighter text-warning-dark",
        state === "pending" && "border-stroke-sub bg-bg-white text-text-sub"
      )}
    >
      {state === "complete" ? <RiCheckLine className={icon} /> : null}
      {state === "active" ? (
        <RiLoader4Line className={cn(icon, "animate-spin motion-reduce:animate-none")} />
      ) : null}
      {state === "queued" ? <RiTimeLine className={icon} /> : null}
      {state === "failed" || state === "warning" ? <RiCloseLine className={icon} /> : null}
      {state === "pending" ? <span>{label}</span> : null}
    </span>
  );
}
