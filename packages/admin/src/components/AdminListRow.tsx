import { cn } from "@green-goods/shared/utils/styles/cn";
import * as React from "react";

export interface AdminListRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The row's record is the one open now: announced as current and ringed. */
  current?: boolean;
}

/**
 * AdminListRow — a list row that opens its record.
 *
 * The whole row is one full-width, left-aligned button whose height follows its
 * content, never below the 44px finger box. That is what AdminButton cannot be:
 * an action carries one label on a fixed compact height (DL-011), so a title over
 * a meta line spills out of it. The row owns the box (surface, corner, ink state
 * layer, focus ring, current ring); the caller lays out the content, which can
 * answer the row's hover through `group-hover:`.
 */
export const AdminListRow = React.forwardRef<HTMLButtonElement, AdminListRowProps>(
  ({ current = false, className, type = "button", children, ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-current={current ? "true" : undefined}
      data-component="AdminListRow"
      data-current={current ? "true" : "false"}
      className={cn(
        "group block min-h-11 w-full rounded-[var(--m3-shape-lg)] border border-stroke-soft bg-bg-weak px-3 py-2 text-left",
        "m3-state-layer [--state-layer-color:var(--m3-on-surface)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]",
        current && "ring-1 ring-primary-base",
        className
      )}
    >
      {children}
    </button>
  )
);

AdminListRow.displayName = "AdminListRow";
