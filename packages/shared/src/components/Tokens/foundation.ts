import { tv } from "tailwind-variants";

const controlSurfaceBase = [
  "w-full rounded-xl border border-stroke-sub-300 bg-bg-white-0 text-text-strong-950 shadow-none",
  "placeholder:text-text-soft-400",
  "transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out",
  "focus-visible:outline-none focus-visible:border-primary-base focus-visible:ring-2 focus-visible:ring-primary-alpha-16",
  "disabled:pointer-events-none disabled:opacity-60 disabled:bg-bg-soft-200",
  "text-paragraph-md sm:text-paragraph-sm",
];

const controlSizeClasses = {
  sm: "min-h-10 px-3 py-2",
  md: "min-h-11 px-3.5 py-2.5",
  lg: "min-h-12 px-4 py-3 sm:text-paragraph-md",
} as const;

export const controlStyleSizes = {
  sm: {
    minHeight: 40,
    paddingX: 12,
    paddingY: 8,
    gap: 8,
    borderRadius: 12,
  },
  md: {
    minHeight: 44,
    paddingX: 14,
    paddingY: 10,
    gap: 10,
    borderRadius: 12,
  },
  lg: {
    minHeight: 48,
    paddingX: 16,
    paddingY: 12,
    gap: 10,
    borderRadius: 12,
  },
} as const;

export const controlInputVariants = tv({
  base: [...controlSurfaceBase],
  variants: {
    size: controlSizeClasses,
    invalid: {
      true: "border-error-base focus-visible:border-error-base focus-visible:ring-error-light",
      false: "",
    },
  },
  defaultVariants: {
    size: "md",
    invalid: false,
  },
});

export const controlTextareaVariants = tv({
  base: [...controlSurfaceBase, "resize-y align-top"],
  variants: {
    size: {
      sm: `${controlSizeClasses.sm} min-h-24`,
      md: `${controlSizeClasses.md} min-h-28`,
      lg: `${controlSizeClasses.lg} min-h-32`,
    },
    invalid: {
      true: "border-error-base focus-visible:border-error-base focus-visible:ring-error-light",
      false: "",
    },
  },
  defaultVariants: {
    size: "md",
    invalid: false,
  },
});

export const selectTriggerVariants = tv({
  base: [
    ...controlSurfaceBase,
    "inline-flex items-center justify-between gap-3 whitespace-nowrap text-left",
    "data-[placeholder]:text-text-soft-400",
    "[&>span]:line-clamp-1",
  ],
  variants: {
    size: controlSizeClasses,
    invalid: {
      true: "border-error-base focus-visible:border-error-base focus-visible:ring-error-light",
      false: "",
    },
  },
  defaultVariants: {
    size: "md",
    invalid: false,
  },
});

export const iconButtonVariants = tv({
  base: [
    "relative inline-flex shrink-0 items-center justify-center rounded-xl border border-stroke-soft-200",
    "bg-bg-white-0 text-text-sub-600 shadow-none",
    "transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:border-primary-base focus-visible:ring-2 focus-visible:ring-primary-alpha-16",
    "active:scale-95",
    "disabled:pointer-events-none disabled:opacity-60 disabled:bg-bg-soft-200",
  ],
  variants: {
    size: {
      sm: "size-10",
      md: "size-11",
      lg: "size-12",
    },
    tone: {
      default: "hover:border-stroke-sub-300 hover:bg-bg-weak-50 hover:text-text-strong-950",
      ghost:
        "border-transparent bg-transparent shadow-none hover:bg-bg-soft-200 hover:text-text-strong-950",
      inverse:
        "border-white-alpha-16 bg-black-alpha-24 text-white hover:bg-black-alpha-24 hover:text-white",
    },
  },
  defaultVariants: {
    size: "md",
    tone: "default",
  },
});

export const iconButtonIconVariants = tv({
  base: "pointer-events-none shrink-0",
  variants: {
    size: {
      sm: "h-4 w-4",
      md: "h-4 w-4",
      lg: "h-5 w-5",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export const cardShellVariants = tv({
  base: "rounded-2xl border border-stroke-soft-200 bg-bg-white-0 shadow-regular-xs",
  variants: {
    surface: {
      default: "",
      muted: "bg-bg-weak-50",
      ghost: "border-transparent bg-transparent shadow-none",
    },
    interactive: {
      true: "transition-[background-color,border-color,box-shadow,transform] duration-200 hover:border-stroke-sub-300 hover:shadow-regular-sm active:translate-y-px",
      false: "",
    },
  },
  defaultVariants: {
    surface: "default",
    interactive: false,
  },
});

export const cardSectionVariants = tv({
  base: "flex flex-col",
  variants: {
    size: {
      sm: "px-4 py-3",
      md: "px-5 py-4 sm:px-6 sm:py-5",
      lg: "px-6 py-5 sm:px-7 sm:py-6",
    },
    divider: {
      top: "border-t border-stroke-soft-200",
      bottom: "border-b border-stroke-soft-200",
      none: "",
    },
  },
  defaultVariants: {
    size: "md",
    divider: "none",
  },
});

export const formLabelClassName = "text-label-sm text-text-strong-950";
export const formHelperClassName = "text-paragraph-xs text-text-sub-600";
export const formErrorClassName = "text-paragraph-xs text-error-base";
export const cardTitleClassName = "text-label-md text-text-strong-950";
export const cardDescriptionClassName = "text-paragraph-sm text-text-sub-600";
