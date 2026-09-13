/**
 * Button — the one action button for the installed PWA, the public site, and
 * shared chrome such as SheetActions.
 *
 * Shape follows emphasis (DL-021): a primary is a capsule, a secondary is the
 * 12px squircle, and a tertiary is text with a squircle fill on hover. There is
 * no shape prop. Heights ride the field scale (DL-023): lg 48, md 44, sm 40,
 * compact 32, and the two short sizes keep a 48px hit area. The styles live in
 * shared `theme.css` as `.gg-button[data-*]` rules because Tailwind does not
 * scan `packages/shared/src/` from the app builds.
 *
 * A loading button stays focusable: it is `aria-disabled` and `aria-busy` and
 * ignores activation, a form submit included, instead of dropping focus through
 * native `disabled`.
 *
 * `variant` is the legacy class contract. Only the shared internals that admin
 * still renders (EmptyState, toasts, FormWizard) pass it, so admin keeps its
 * current buttons; new code passes `emphasis`.
 *
 * @module components/Button
 */
import { RiLoader4Line } from "@remixicon/react";
import * as React from "react";
import { tv } from "tailwind-variants";
import { cn } from "../utils/styles/cn";

/** @deprecated Legacy class contract for admin-reachable shared internals. Use `emphasis`. */
export const buttonVariants = tv({
  base: "gg-button",
  variants: {
    variant: {
      primary: "gg-button-primary gg-button-filled",
      secondary: "gg-button-secondary",
      ghost: "gg-button-ghost",
      danger: "gg-button-danger",
    },
    size: {
      sm: "gg-button-size-sm",
      md: "gg-button-size-md",
      lg: "gg-button-size-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

export type ButtonEmphasis = "primary" | "secondary" | "tertiary";
export type ButtonTone = "default" | "danger" | "warning";
export type ButtonSize = "lg" | "md" | "sm" | "compact";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Primary is the filled capsule, secondary the outlined squircle, tertiary text. */
  emphasis?: ButtonEmphasis;
  /** `danger` fills a primary with the error color and tints the others; `warning` fills a primary. */
  tone?: ButtonTone;
  size?: ButtonSize;
  /** @deprecated Legacy class contract kept for admin-reachable shared internals. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Leading icon. The loading spinner replaces it while `loading`. */
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  loading?: boolean;
  asChild?: boolean;
}

type SlottableChildProps = {
  className?: string;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
  [key: string]: unknown;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      emphasis = "primary",
      tone = "default",
      size = "md",
      variant,
      leadingIcon,
      trailingIcon,
      asChild = false,
      loading = false,
      disabled,
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    const legacy = variant !== undefined;
    const legacySize = size === "compact" ? "sm" : size;
    const baseClassName = legacy ? buttonVariants({ variant, size: legacySize }) : "gg-button";
    const busy = loading || props["aria-busy"] || undefined;
    const stateProps = legacy
      ? { "aria-busy": busy }
      : {
          "data-emphasis": emphasis,
          "data-tone": tone === "default" ? undefined : tone,
          "data-size": size,
          "aria-busy": busy,
          "aria-disabled": loading || props["aria-disabled"] || undefined,
        };
    const content = (inner: React.ReactNode) => (
      <>
        {loading ? (
          <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          leadingIcon
        )}
        {inner}
        {trailingIcon}
      </>
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<SlottableChildProps>;
      return React.cloneElement(child, {
        ...(props as SlottableChildProps),
        ...stateProps,
        ref,
        className: cn(baseClassName, child.props.className, className),
        children: content(child.props.children),
      });
    }

    return (
      <button
        ref={ref}
        {...props}
        {...stateProps}
        className={cn(baseClassName, className)}
        // Legacy buttons disable natively while loading; the emphasis API stays focusable.
        disabled={legacy ? disabled || loading : loading ? undefined : disabled}
        onClick={(event) => {
          if (!legacy && loading) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
      >
        {content(children)}
      </button>
    );
  }
);
Button.displayName = "Button";
