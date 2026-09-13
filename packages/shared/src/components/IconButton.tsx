/**
 * IconButton — a circular button that carries only an icon: close, back,
 * share, menu, remove (DL-021).
 *
 * The accessible name is required. Sizes match the Button scale (lg 48, md 44,
 * sm 40, compact 32) and the two short sizes keep a 48px hit area. Tertiary is
 * transparent until hover, secondary is outlined, primary is filled. While
 * pressed the circle tightens to the 12px squircle. A launcher's count or
 * status dot rides the `badge` slot. Styles live in shared `theme.css` as
 * `.gg-icon-button` rules.
 *
 * @module components/IconButton
 */
import { RiLoader4Line } from "@remixicon/react";
import * as React from "react";
import { cn } from "../utils/styles/cn";
import type { ButtonEmphasis, ButtonSize } from "./Button";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  /** The accessible name; icon-only buttons have no visible label. */
  "aria-label": string;
  icon: React.ReactNode;
  /**
   * Overlay pinned to the top-right corner, such as a count or a status dot.
   * It stays visible while loading; say what it shows in `aria-label` too.
   */
  badge?: React.ReactNode;
  emphasis?: ButtonEmphasis;
  tone?: "default" | "danger";
  size?: ButtonSize;
  /** In-flight state: shows the spinner, sets `aria-busy`, and ignores activation. */
  loading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      badge,
      emphasis = "tertiary",
      tone = "default",
      size = "md",
      loading = false,
      disabled,
      className,
      type,
      onClick,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type ?? "button"}
      {...props}
      className={cn("gg-icon-button", className)}
      data-emphasis={emphasis}
      data-tone={tone === "default" ? undefined : tone}
      data-size={size}
      disabled={loading ? undefined : disabled}
      aria-disabled={loading || props["aria-disabled"] || undefined}
      aria-busy={loading || props["aria-busy"] || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {loading ? <RiLoader4Line className="animate-spin" aria-hidden="true" /> : icon}
      {badge ? <span className="gg-icon-button-badge">{badge}</span> : null}
    </button>
  )
);
IconButton.displayName = "IconButton";
