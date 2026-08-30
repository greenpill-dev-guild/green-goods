import { RiLoader4Line } from "@remixicon/react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@green-goods/shared/utils/styles/cn";

// ============================================================================
// Variant System
// ============================================================================

const adminButtonVariants = tv({
  base: [
    // Layout & shape
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--m3-shape-full)]",
    // Geometry parity — every variant carries a 1px border box so the box never
    // changes width when a button swaps filled↔outlined (e.g. the active-tab
    // action). Auto-width buttons grow by the border, so without this the
    // outlined variant rendered 2px wider than filled (measured). Outlined
    // overrides only the border COLOR.
    "border border-transparent",
    // Typography — Title Case labels as authored ("Create Assessment",
    // DL-012; en only — es/pt keep native casing); no text-transform.
    "text-label-lg font-medium",
    // Motion
    "transition-all duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
    // State layer (pseudo-element overlay defined in admin-m3-tokens.css)
    "m3-state-layer",
    // Focus ring
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-visible:ring-offset-2",
    // Disabled
    "disabled:pointer-events-none",
    "disabled:bg-[rgb(var(--m3-on-surface)/0.12)] disabled:text-[rgb(var(--m3-on-surface)/0.38)] disabled:shadow-none",
  ],
  variants: {
    variant: {
      // Filled — highest emphasis. Uses the workspace's `--tone-action` so each
      // view feels distinct (Hub blue / Garden green / Community orange /
      // Actions red / Home stone). Hover keeps geometry stable and uses
      // elevation/state-layer feedback instead of translating the control.
      filled: [
        "bg-[rgb(var(--tone-action,var(--primary-action)))] [color:rgb(var(--tone-on-action,var(--primary-action-foreground)))]",
        "shadow-[var(--m3-elevation-1)] hover:shadow-[var(--m3-elevation-2)]",
        "[--state-layer-color:var(--tone-on-action,var(--primary-action-foreground))]",
      ],
      // Tonal — medium emphasis
      tonal: [
        "bg-[rgb(var(--m3-secondary-container))] [color:rgb(var(--m3-on-secondary-container))]",
        "shadow-[var(--m3-elevation-0)] hover:shadow-[var(--m3-elevation-1)]",
        "[--state-layer-color:var(--m3-on-secondary-container)]",
      ],
      // Elevated — medium emphasis with surface tint
      elevated: [
        "bg-[rgb(var(--m3-surface-container-low))] [color:rgb(var(--tone-on-surface-accent,var(--m3-primary)))]",
        "shadow-[var(--m3-elevation-1)] hover:shadow-[var(--m3-elevation-2)]",
        "[--state-layer-color:var(--m3-primary)]",
      ],
      // Outlined — low emphasis with border. Matches the filled hover through
      // elevation gain, without moving the button box.
      outlined: [
        "bg-transparent [color:rgb(var(--tone-on-surface-accent,var(--m3-primary)))]",
        "border-[rgb(var(--m3-outline))]",
        "shadow-[var(--m3-elevation-0)] hover:shadow-[var(--m3-elevation-1)]",
        "[--state-layer-color:var(--m3-primary)]",
      ],
      // Text — lowest emphasis
      text: [
        "bg-transparent [color:rgb(var(--tone-on-surface-accent,var(--m3-primary)))]",
        "shadow-[var(--m3-elevation-0)]",
        "[--state-layer-color:var(--m3-primary)]",
      ],
      // Danger — destructive action
      danger: [
        "bg-[rgb(var(--m3-error))] [color:rgb(var(--m3-on-error))]",
        "shadow-[var(--m3-elevation-0)] hover:shadow-[var(--m3-elevation-1)]",
        "[--state-layer-color:var(--m3-on-error)]",
      ],
    },
    size: {
      // Compact cockpit metric (DL-011): 28 / 32 / 40. Visual heights sit
      // below the 44px accessibility floor for sm and md, so both carry
      // admin-hit-target (28dp/32dp visual, 44px effective).
      // Densest action — list rows, table actions, inline text buttons.
      sm: "admin-hit-target h-7 px-2.5 text-label-sm",
      // Standard action (32dp).
      md: "admin-hit-target h-8 px-4 text-label-lg",
      // Prominent first-action button (40dp). Label stays 14px — size
      // difference carries the emphasis, not a type jump.
      lg: "h-10 px-5 text-label-lg",
    },
    hasLeadingIcon: {
      true: "pl-3",
      false: "",
    },
  },
  compoundVariants: [
    // When hasLeadingIcon + md → pl-3 pr-4
    { size: "md", hasLeadingIcon: true, class: "pl-3 pr-4" },
    // When hasLeadingIcon + sm → pl-2 pr-2.5 (tight spacing for the dense size)
    { size: "sm", hasLeadingIcon: true, class: "pl-2 pr-2.5" },
    // When hasLeadingIcon + lg → pl-3.5 pr-5
    { size: "lg", hasLeadingIcon: true, class: "pl-3.5 pr-5" },
  ],
  defaultVariants: {
    variant: "filled",
    size: "md",
    hasLeadingIcon: false,
  },
});

// ============================================================================
// Types
// ============================================================================

type AdminButtonVariantProps = VariantProps<typeof adminButtonVariants>;

export interface AdminButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<AdminButtonVariantProps, "hasLeadingIcon"> {
  /** Render as child element (Radix Slot pattern). */
  asChild?: boolean;
  /** Show spinner + aria-busy. */
  loading?: boolean;
  /** Leading icon element — adjusts padding automatically. */
  leadingIcon?: React.ReactNode;
}

type SlottableChildProps = {
  className?: string;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
  [key: string]: unknown;
};

// ============================================================================
// Component
// ============================================================================

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leadingIcon,
      disabled,
      children,
      // Native buttons default to type="submit", so an AdminButton inside any
      // <form> would submit it (full page reload) unless every call site
      // remembers type="button". Default to the safe type; submit buttons opt
      // in explicitly. Not forwarded to asChild clones (anchors have no type).
      type = "button",
      ...props
    },
    ref
  ) => {
    const hasLeadingIcon = Boolean(leadingIcon) || loading;

    const classes = cn(adminButtonVariants({ variant, size, hasLeadingIcon }), className);

    // 16px icons in the densest tier; 18px otherwise.
    const iconSize = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
    const leadingSlot = loading ? (
      <RiLoader4Line className={cn(iconSize, "shrink-0 animate-spin")} aria-hidden />
    ) : leadingIcon ? (
      <span className={cn(iconSize, "shrink-0 [&>svg]:h-full [&>svg]:w-full")} aria-hidden>
        {leadingIcon}
      </span>
    ) : null;

    const content = (
      <>
        {leadingSlot}
        {children}
      </>
    );

    // asChild pattern — clone the single child element and apply button styling
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<SlottableChildProps>;
      const childProps = child.props;

      return React.cloneElement(child, {
        ...(props as SlottableChildProps),
        ref,
        className: cn(classes, childProps.className),
        "data-component": "AdminButton",
        "aria-busy": loading || undefined,
        children: (
          <>
            {leadingSlot}
            {childProps.children}
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
        type={type}
        {...props}
      >
        {content}
      </button>
    );
  }
);

AdminButton.displayName = "AdminButton";
