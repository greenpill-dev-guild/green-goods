import { cn } from "@green-goods/shared";
import type React from "react";

type EmptyStateTone = "neutral" | "warning" | "error";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: EmptyStateTone;
  className?: string;
}

const toneClassNames: Record<EmptyStateTone, string> = {
  neutral: "border-stroke-soft-200 bg-bg-weak-50 text-primary",
  warning: "border-warning-light bg-warning-lighter text-warning-base",
  error: "border-error-light bg-error-lighter text-error-base",
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[12rem] flex-col items-center justify-center px-6 py-8 text-center",
        className
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border",
          toneClassNames[tone]
        )}
        aria-hidden="true"
      >
        <span className="flex items-center justify-center [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      </div>
      <div className="mt-3 max-w-sm">
        <h3 className="text-sm font-medium text-text-strong-950">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-text-sub-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
