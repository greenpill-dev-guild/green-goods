import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";

export interface AdminSettingRowProps {
  /**
   * Field title. Uses the shared `FormField` label treatment so a setting row
   * never reads smaller or greyer than the stacked text fields beside it.
   */
  label: string;
  /**
   * id for the title so a paired control can name itself via `aria-labelledby`.
   * The title is a `<span>`, not a `<label htmlFor>`, because Radix-style
   * controls (e.g. `Switch`) take an accessible name by reference, not by input
   * association — pass this whenever the trailing control is one of those.
   */
  labelId?: string;
  /** Optional supporting line under the title. */
  description?: string;
  /** The trailing control — a `Switch`, compact input, or button. */
  children: ReactNode;
  className?: string;
}

/**
 * AdminSettingRow — a field title (left) paired with a trailing control (right).
 *
 * The inline "setting row" grammar for toggles and compact controls inside admin
 * forms and dialogs (open joining, gardener limit, …). Reach for this — never a
 * hand-rolled `label-xs text-text-soft` eyebrow — so field titles stay uniform
 * with the stacked {@link FormField} labels beside them. For a full-width
 * label-on-top field with a single input, use `FormField` instead.
 */
export function AdminSettingRow({
  label,
  labelId,
  description,
  children,
  className,
}: AdminSettingRowProps) {
  return (
    <div
      data-component="AdminSettingRow"
      className={cn("flex items-center justify-between gap-4", className)}
    >
      <div className="min-w-0">
        <span id={labelId} className="font-medium text-text-strong-950 text-label-lg">
          {label}
        </span>
        {description ? <p className="mt-1 text-body-sm text-text-sub-600">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

AdminSettingRow.displayName = "AdminSettingRow";
