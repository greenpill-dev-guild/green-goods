import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiStackLine,
} from "@remixicon/react";
import type { ReactNode } from "react";

export type FlowStatusTone = "neutral" | "info" | "success" | "warning" | "error";

export interface FlowStatusRowProps {
  tone: FlowStatusTone;
  title: string;
  description: string;
  /** Something is under way: a spinner takes the icon's place. */
  busy?: boolean;
  /** 0–100, for a flow the wallet takes one step at a time. */
  progress?: number | null;
  /**
   * Label/value rows that stay put under the status, for a sending dialog whose
   * one summary carries both (Add to This Group, Edit Reward).
   */
  summary?: ReadonlyArray<readonly [ReactNode, ReactNode]>;
  className?: string;
}

const TONE: Record<FlowStatusTone, { box: string; icon: string; title: string }> = {
  neutral: {
    box: "bg-bg-weak border-bg-weak",
    icon: "text-text-sub",
    title: "text-text-strong",
  },
  info: {
    box: "bg-information-lighter border-information-light",
    icon: "text-information-dark",
    title: "text-text-strong",
  },
  success: {
    box: "bg-success-lighter border-success-light",
    icon: "text-success-dark",
    title: "text-text-strong",
  },
  warning: {
    box: "bg-warning-lighter border-warning-light",
    icon: "text-warning-dark",
    title: "text-warning-dark",
  },
  error: {
    box: "bg-error-lighter border-error-light",
    icon: "text-error-dark",
    title: "text-error-dark",
  },
};

function StatusIcon({ tone, busy }: { tone: FlowStatusTone; busy: boolean }) {
  const className = "h-5 w-5";
  if (busy) return <RiLoader4Line className={cn(className, "animate-spin")} aria-hidden />;
  switch (tone) {
    case "success":
      return <RiCheckboxCircleLine className={className} aria-hidden />;
    case "warning":
      return <RiErrorWarningLine className={className} aria-hidden />;
    case "error":
      return <RiCloseCircleLine className={className} aria-hidden />;
    default:
      return <RiStackLine className={className} aria-hidden />;
  }
}

/**
 * FlowStatusRow — the one line a sending flow changes while it works (PRD-1022
 * D16 review, D7 sending). It keeps one height through ready, approving,
 * declined, created, sending and partial, so the review below it never moves:
 * only its tone and its words change. The words are announced politely; the
 * icon is decoration (the tone is always in the words too).
 *
 * With a `summary`, it is the single summary at the top of a sending dialog:
 * the status lines first, then rows that stay where they are.
 */
export function FlowStatusRow({
  tone,
  title,
  description,
  busy = false,
  progress = null,
  summary,
  className,
}: FlowStatusRowProps) {
  const styles = TONE[tone];
  return (
    <div
      data-component="FlowStatusRow"
      data-tone={tone}
      className={cn(
        "grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 rounded-[var(--m3-shape-md)] border px-4 py-3",
        summary ? "items-start" : "min-h-[150px] content-center sm:min-h-24",
        styles.box,
        className
      )}
    >
      <span className={cn("grid pt-0.5", styles.icon)}>
        <StatusIcon tone={tone} busy={busy} />
      </span>
      <div
        role="status"
        aria-live="polite"
        className={cn("min-w-0", summary && "min-h-[58px] sm:min-h-10")}
      >
        <p className={cn("body-sm font-semibold", styles.title)}>{title}</p>
        <p className="body-xs text-text-sub">{description}</p>
        {progress !== null ? (
          <div
            className="mt-2 h-1 overflow-hidden rounded-full bg-stroke-soft"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            {/* A semantic fill, not the workspace tone: the tone's four uses are spoken for (Rule 18). */}
            <div
              className="h-full bg-information-base"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        ) : null}
      </div>
      {summary ? (
        <dl className="col-start-2 mt-2 space-y-1 border-t border-stroke-soft pt-2">
          {summary.map(([label, value], index) => (
            <div key={index} className="flex justify-between gap-4 body-sm">
              <dt className="max-w-[55%] shrink-0 text-text-soft">{label}</dt>
              <dd className="min-w-0 text-right text-text-strong">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
