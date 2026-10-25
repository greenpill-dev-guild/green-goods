/**
 * IconButton — a circular button that carries only an icon: close, back,
 * share, menu, remove (DL-026).
 *
 * The accessible name is required. Sizes match the Button scale (lg 48, md 44,
 * sm 40, compact 32) and the two short sizes keep a 48px hit area. Tertiary is
 * transparent until hover, secondary is outlined, primary is filled. While
 * pressed the circle tightens to the 12px squircle. A launcher's count or
 * status dot rides the `badge` slot. A link drawn as one is `asChild` around
 * the anchor or router link, which holds the glyph, as with `Button`. Styles
 * live in shared `theme.css` as `.gg-icon-button` rules.
 *
 * @module components/IconButton
 */
import { RiLoader4Line } from "@remixicon/react";
import * as React from "react";
import { cn } from "../utils/styles/cn";
import type { ButtonEmphasis, ButtonSize } from "./Button";

interface IconButtonBaseProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  /** The accessible name; icon-only buttons have no visible label. */
  "aria-label": string;
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

export type IconButtonProps = IconButtonBaseProps &
  (
    | { icon: React.ReactNode; asChild?: false; children?: never }
    | {
        /**
         * Draw the child element, an anchor or router link that holds the glyph,
         * as the icon button: the child keeps its own props and content, and the
         * class, state attributes and badge are the icon button's.
         */
        asChild: true;
        children: React.ReactElement;
        icon?: never;
      }
  );

type SlottableChildProps = {
  className?: string;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
  [key: string]: unknown;
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      badge,
      emphasis = "tertiary",
      tone = "default",
      size = "md",
      loading = false,
      asChild = false,
      disabled,
      className,
      type,
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    const stateProps = {
      "data-emphasis": emphasis,
      "data-tone": tone === "default" ? undefined : tone,
      "data-size": size,
      "aria-disabled": loading || props["aria-disabled"] || undefined,
      "aria-busy": loading || props["aria-busy"] || undefined,
    };
    const content = (glyph: React.ReactNode) => (
      <>
        {loading ? <RiLoader4Line className="animate-spin" aria-hidden="true" /> : glyph}
        {badge ? <span className="gg-icon-button-badge">{badge}</span> : null}
      </>
    );
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (loading) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    };

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<SlottableChildProps>;
      const childOnClick = child.props.onClick as
        | ((event: React.MouseEvent<HTMLButtonElement>) => void)
        | undefined;
      // Unset state attributes must not erase the child's own (an aria-disabled link).
      const childStateProps = Object.fromEntries(
        Object.entries(stateProps).filter(([, value]) => value !== undefined)
      );
      return React.cloneElement(child, {
        ...(props as SlottableChildProps),
        ...childStateProps,
        ref,
        className: cn("gg-icon-button", child.props.className, className),
        // The child's own handler runs first, as with a Radix Slot.
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          childOnClick?.(event);
          if (!event.defaultPrevented) handleClick(event);
        },
        children: content(child.props.children),
      });
    }

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        {...props}
        {...stateProps}
        className={cn("gg-icon-button", className)}
        disabled={loading ? undefined : disabled}
        onClick={handleClick}
      >
        {content(icon)}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";
