import { RiLoader4Line } from "@remixicon/react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@green-goods/shared";

// ============================================================================
// Variant System
// ============================================================================

export const adminButtonVariants = tv({
  base: [
    // Layout & shape
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--m3-shape-full)]",
    // Typography
    "text-label-lg font-medium",
    // Motion
    "transition-all duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)]",
    // State layer (pseudo-element overlay defined in admin-m3-tokens.css)
    "m3-state-layer",
    // Focus ring
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))] focus-visible:ring-offset-2",
    // Disabled
    "disabled:pointer-events-none",
    "disabled:bg-[rgb(var(--m3-on-surface)/0.12)] disabled:text-[rgb(var(--m3-on-surface)/0.38)] disabled:shadow-none",
  ],
  variants: {
    variant: {
      // Filled — highest emphasis
      filled: [
        "bg-[rgb(var(--ws-action,var(--primary-action)))] text-[rgb(var(--ws-on-action,var(--primary-action-foreground)))]",
        "shadow-[var(--m3-elevation-0)] hover:shadow-[var(--m3-elevation-1)]",
        "[--state-layer-color:var(--ws-on-action,var(--primary-action-foreground))]",
      ],
      // Tonal — medium emphasis
      tonal: [
        "bg-[rgb(var(--m3-secondary-container))] text-[rgb(var(--m3-on-secondary-container))]",
        "shadow-[var(--m3-elevation-0)] hover:shadow-[var(--m3-elevation-1)]",
        "[--state-layer-color:var(--m3-on-secondary-container)]",
      ],
      // Elevated — medium emphasis with surface tint
      elevated: [
        "bg-[rgb(var(--m3-surface-container-low))] text-[rgb(var(--m3-primary))]",
        "shadow-[var(--m3-elevation-1)] hover:shadow-[var(--m3-elevation-2)]",
        "[--state-layer-color:var(--m3-primary)]",
      ],
      // Outlined — low emphasis with border
      outlined: [
        "bg-transparent text-[rgb(var(--m3-primary))]",
        "border border-[rgb(var(--m3-outline))]",
        "shadow-[var(--m3-elevation-0)]",
        "[--state-layer-color:var(--m3-primary)]",
      ],
      // Text — lowest emphasis
      text: [
        "bg-transparent text-[rgb(var(--m3-primary))]",
        "shadow-[var(--m3-elevation-0)]",
        "[--state-layer-color:var(--m3-primary)]",
      ],
      // Danger — destructive action
      danger: [
        "bg-[rgb(var(--m3-error))] text-[rgb(var(--m3-on-error))]",
        "shadow-[var(--m3-elevation-0)] hover:shadow-[var(--m3-elevation-1)]",
        "[--state-layer-color:var(--m3-on-error)]",
      ],
    },
    size: {
      sm: "h-10 px-4 text-label-sm",
      md: "h-10 px-6 text-label-lg",
      lg: "h-12 px-6 text-body-lg",
    },
    hasLeadingIcon: {
      true: "pl-4",
      false: "",
    },
  },
  compoundVariants: [
    // When hasLeadingIcon + md → pl-4 pr-6
    { size: "md", hasLeadingIcon: true, class: "pl-4 pr-6" },
    // When hasLeadingIcon + sm → pl-3 pr-4
    { size: "sm", hasLeadingIcon: true, class: "pl-3 pr-4" },
    // When hasLeadingIcon + lg → pl-4 pr-6
    { size: "lg", hasLeadingIcon: true, class: "pl-4 pr-6" },
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
      ...props
    },
    ref
  ) => {
    const hasLeadingIcon = Boolean(leadingIcon) || loading;

    const classes = cn(adminButtonVariants({ variant, size, hasLeadingIcon }), className);

    const leadingSlot = loading ? (
      <RiLoader4Line className="h-[18px] w-[18px] shrink-0 animate-spin" aria-hidden />
    ) : leadingIcon ? (
      <span className="h-[18px] w-[18px] shrink-0 [&>svg]:h-full [&>svg]:w-full" aria-hidden>
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
        {...props}
      >
        {content}
      </button>
    );
  }
);

AdminButton.displayName = "AdminButton";
