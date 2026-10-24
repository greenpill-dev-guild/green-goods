import {
  Button,
  type ButtonEmphasis,
  type ButtonSize,
  type ButtonTone,
} from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiLoader4Line } from "@remixicon/react";
import * as React from "react";
import { tv } from "tailwind-variants";

// ============================================================================
// The cockpit's buttons are the shared family (DL-115)
// ============================================================================
//
// AdminButton and AdminIconButton keep their names and props, so the cockpit's
// call sites are unchanged, and render the shared Button and IconButton. Each
// variant maps onto a shared emphasis and tone, and each size onto the shared
// size that the cockpit's tokens put on its 28 / 32 / 40px tiers with a 44px
// finger box (index.css, DL-031). The cockpit's look lives in those tokens, not
// in classes here. A later pass renames the call sites and retires these files.

export type AdminButtonVariant =
  | "filled"
  | "tonal"
  | "elevated"
  | "outlined"
  | "text"
  | "danger"
  | "outlinedDanger";
export type AdminButtonSize = "sm" | "md" | "lg";

const BUTTON_EMPHASIS: Record<
  Exclude<AdminButtonVariant, "tonal">,
  { emphasis: ButtonEmphasis; tone?: ButtonTone }
> = {
  filled: { emphasis: "primary" },
  outlined: { emphasis: "secondary" },
  // No shared emphasis is a raised surface; elevated sat beside outlined.
  elevated: { emphasis: "secondary" },
  text: { emphasis: "tertiary" },
  danger: { emphasis: "primary", tone: "danger" },
  outlinedDanger: { emphasis: "secondary", tone: "danger" },
};

/** The cockpit's tiers on the shared sizes its tokens put at 28, 32 and 40px. */
const SHARED_SIZE: Record<AdminButtonSize, ButtonSize> = { sm: "compact", md: "sm", lg: "lg" };

// The shared Button leaves its leading glyph unsized: 16px on the densest
// tier, 18px otherwise.
const glyphSize = (size: AdminButtonSize) => (size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]");

type SlottableChildProps = {
  className?: string;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
  [key: string]: unknown;
};

export interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant | null;
  size?: AdminButtonSize | null;
  /** Render as child element (Radix Slot pattern). */
  asChild?: boolean;
  /** Show spinner + aria-busy; the button stays focusable and ignores presses. */
  loading?: boolean;
  /** Leading icon element. */
  leadingIcon?: React.ReactNode;
}

// ============================================================================
// Tonal: the chosen option in a set, until phase 2
// ============================================================================
//
// Tonal has no shared emphasis. Its remaining uses mark the chosen option in a
// set (a range, a filter, a token), which is a choice rather than an action, so
// it keeps the cockpit's tonal pill until phase 2 moves those sets onto a
// choice control (DL-115).

const tonalChoice = tv({
  base: [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--m3-shape-full)] border border-transparent",
    "type-label font-medium",
    "transition-all duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
    "m3-state-layer",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-visible:ring-offset-2",
    "disabled:pointer-events-none",
    "disabled:bg-[rgb(var(--m3-on-surface)/0.12)] disabled:text-[rgb(var(--m3-on-surface)/0.38)] disabled:shadow-none",
    "aria-disabled:cursor-not-allowed",
    "aria-disabled:bg-[rgb(var(--m3-on-surface)/0.12)] aria-disabled:text-[rgb(var(--m3-on-surface)/0.38)] aria-disabled:shadow-none",
    "bg-[rgb(var(--m3-secondary-container))] [color:rgb(var(--m3-on-secondary-container))]",
    "shadow-[var(--m3-elevation-0)] hover:shadow-[var(--m3-elevation-1)]",
    "[--state-layer-color:var(--m3-on-secondary-container)]",
  ],
  variants: {
    size: {
      sm: "admin-hit-target h-7 px-2.5",
      md: "admin-hit-target h-8 px-4",
      lg: "admin-hit-target-lg h-10 px-5",
    },
    hasLeadingIcon: { true: "pl-3", false: "" },
  },
  compoundVariants: [
    { size: "md", hasLeadingIcon: true, class: "pl-3 pr-4" },
    { size: "sm", hasLeadingIcon: true, class: "pl-2 pr-2.5" },
    { size: "lg", hasLeadingIcon: true, class: "pl-3.5 pr-5" },
  ],
});

const TonalChoiceButton = React.forwardRef<
  HTMLButtonElement,
  Omit<AdminButtonProps, "variant" | "size"> & { size: AdminButtonSize }
>(
  (
    { size, asChild, loading = false, leadingIcon, disabled, className, children, ...props },
    ref
  ) => {
    const classes = cn(
      tonalChoice({ size, hasLeadingIcon: Boolean(leadingIcon) || loading }),
      className
    );
    const leadingSlot = loading ? (
      <RiLoader4Line className={cn(glyphSize(size), "shrink-0 animate-spin")} aria-hidden />
    ) : (
      leadingIcon
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<SlottableChildProps>;
      const { type: _type, ...linkProps } = props;
      return React.cloneElement(child, {
        ...(linkProps as SlottableChildProps),
        ref,
        className: cn(classes, child.props.className),
        "data-component": "AdminButton",
        "aria-busy": loading || undefined,
        children: (
          <>
            {leadingSlot}
            {child.props.children}
          </>
        ),
      });
    }

    return (
      <button
        ref={ref}
        data-component="AdminButton"
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {leadingSlot}
        {children}
      </button>
    );
  }
);

TonalChoiceButton.displayName = "TonalChoiceButton";

// ============================================================================
// AdminButton
// ============================================================================

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  (
    {
      variant,
      size,
      asChild = false,
      loading = false,
      leadingIcon,
      // Native buttons default to type="submit", so an AdminButton inside any
      // <form> would submit it unless every call site remembers type="button".
      // Default to the safe type; submit buttons opt in. A link has no type.
      type = "button",
      children,
      ...props
    },
    ref
  ) => {
    const tier = size ?? "md";
    const icon = leadingIcon ? (
      <span className={cn(glyphSize(tier), "shrink-0 [&>svg]:h-full [&>svg]:w-full")} aria-hidden>
        {leadingIcon}
      </span>
    ) : undefined;

    if (variant === "tonal") {
      return (
        <TonalChoiceButton
          ref={ref}
          size={tier}
          asChild={asChild}
          loading={loading}
          leadingIcon={icon}
          type={type}
          {...props}
        >
          {children}
        </TonalChoiceButton>
      );
    }

    const { emphasis, tone } = BUTTON_EMPHASIS[variant ?? "filled"];
    return (
      <Button
        ref={ref}
        data-component="AdminButton"
        emphasis={emphasis}
        tone={tone}
        size={SHARED_SIZE[tier]}
        loading={loading}
        leadingIcon={icon}
        asChild={asChild}
        type={asChild ? undefined : type}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

AdminButton.displayName = "AdminButton";

// ============================================================================
// AdminIconButton
// ============================================================================

export type AdminIconButtonVariant = "standard" | "accent" | "tonal" | "filled" | "danger";

const ICON_EMPHASIS: Record<AdminIconButtonVariant, { emphasis: ButtonEmphasis; tone?: "danger" }> =
  {
    standard: { emphasis: "tertiary" },
    // The workspace tone keeps to its six uses (Rule 18): an accent glyph takes
    // the neutral ink of the standard one.
    accent: { emphasis: "tertiary" },
    // A tonal circle was a row or overlay action (send, remove a photo), which
    // the outlined circle carries.
    tonal: { emphasis: "secondary" },
    filled: { emphasis: "primary" },
    danger: { emphasis: "tertiary", tone: "danger" },
  };

export interface AdminIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminIconButtonVariant | null;
  size?: AdminButtonSize | null;
  /**
   * Accessible name — icon buttons have no text, so the name is mandatory.
   * Applied as aria-label and title (hover tooltip).
   */
  label: string;
  /** Render as child element (Radix Slot pattern) — e.g. an anchor or Link. */
  asChild?: boolean;
  /** Show spinner + aria-busy in place of the glyph; the button stays focusable. */
  loading?: boolean;
}

export const AdminIconButton = React.forwardRef<HTMLButtonElement, AdminIconButtonProps>(
  (
    {
      variant,
      size,
      label,
      asChild = false,
      loading = false,
      type = "button",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { emphasis, tone } = ICON_EMPHASIS[variant ?? "standard"];
    const sharedSize = SHARED_SIZE[size ?? "md"];

    if (asChild && React.isValidElement(children)) {
      // The shared IconButton is always a <button>, so a link drawn as one takes
      // the class and state attributes the IconButton renders.
      const child = children as React.ReactElement<SlottableChildProps>;
      return React.cloneElement(child, {
        ...(props as SlottableChildProps),
        ref,
        className: cn("gg-icon-button", child.props.className, className),
        "data-component": "AdminIconButton",
        "data-emphasis": emphasis,
        "data-tone": tone,
        "data-size": sharedSize,
        "aria-label": label,
        title: label,
        "aria-busy": loading || undefined,
      });
    }

    return (
      <IconButton
        ref={ref}
        data-component="AdminIconButton"
        aria-label={label}
        title={label}
        icon={children}
        emphasis={emphasis}
        tone={tone}
        size={sharedSize}
        loading={loading}
        type={type}
        className={className}
        {...props}
      />
    );
  }
);

AdminIconButton.displayName = "AdminIconButton";
