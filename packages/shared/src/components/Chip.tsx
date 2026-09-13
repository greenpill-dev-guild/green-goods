/**
 * Chip — a capsule toggle for filters and choices (DL-021).
 *
 * 32px tall with a 44px hit area (`size="sm"` is 40px). The selected state is
 * announced with the attribute that matches the role: `aria-pressed` for a
 * plain toggle, `aria-checked` inside a radio or checkbox group, and
 * `aria-selected` for a tab or option. A selected chip uses the action fill with
 * white text (DL-017). Styles live in shared `theme.css` as `.gg-chip` rules.
 *
 * @module components/Chip
 */
import * as React from "react";
import { cn } from "../utils/styles/cn";

export interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: React.ReactNode;
  selected?: boolean;
  size?: "compact" | "sm";
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const CHECKED_ROLES = new Set(["radio", "checkbox", "menuitemradio", "menuitemcheckbox"]);
const SELECTED_ROLES = new Set(["tab", "option"]);

function selectionAttribute(role: string | undefined, selected: boolean) {
  if (role && CHECKED_ROLES.has(role)) return { "aria-checked": selected };
  if (role && SELECTED_ROLES.has(role)) return { "aria-selected": selected };
  return { "aria-pressed": selected };
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      selected = false,
      size = "compact",
      leadingIcon,
      trailingIcon,
      className,
      role,
      type,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type ?? "button"}
      role={role}
      {...selectionAttribute(role, selected)}
      {...props}
      className={cn("gg-chip", className)}
      data-size={size === "compact" ? undefined : size}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  )
);
Chip.displayName = "Chip";
