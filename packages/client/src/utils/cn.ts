export { type ClassValue } from "clsx";
import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const texts = {
  "title-h1": [
    "3.5rem",
    {
      lineHeight: "4rem",
      letterSpacing: "-0.01em",
      fontWeight: "500",
    },
  ],
  "title-h2": [
    "3rem",
    {
      lineHeight: "3.5rem",
      letterSpacing: "-0.01em",
      fontWeight: "500",
    },
  ],
  "title-h3": [
    "2.5rem",
    {
      lineHeight: "3rem",
      letterSpacing: "-0.01em",
      fontWeight: "500",
    },
  ],
  "title-h4": [
    "2rem",
    {
      lineHeight: "2.5rem",
      letterSpacing: "-0.005em",
      fontWeight: "500",
    },
  ],
  "title-h5": [
    "1.5rem",
    {
      lineHeight: "2rem",
      letterSpacing: "0em",
      fontWeight: "500",
    },
  ],
  "title-h6": [
    "1.25rem",
    {
      lineHeight: "1.75rem",
      letterSpacing: "0em",
      fontWeight: "500",
    },
  ],
  "label-xl": [
    "1.5rem",
    {
      lineHeight: "2rem",
      letterSpacing: "-0.015em",
      fontWeight: "500",
    },
  ],
  "label-lg": [
    "1.125rem",
    {
      lineHeight: "1.5rem",
      letterSpacing: "-0.015em",
      fontWeight: "500",
    },
  ],
  "label-md": [
    "1rem",
    {
      lineHeight: "1.5rem",
      letterSpacing: "-0.011em",
      fontWeight: "500",
    },
  ],
  "label-sm": [
    ".875rem",
    {
      lineHeight: "1.25rem",
      letterSpacing: "-0.006em",
      fontWeight: "500",
    },
  ],
  "label-xs": [
    ".75rem",
    {
      lineHeight: "1rem",
      letterSpacing: "0em",
      fontWeight: "500",
    },
  ],
  "paragraph-xl": [
    "1.5rem",
    {
      lineHeight: "2rem",
      letterSpacing: "-0.015em",
      fontWeight: "400",
    },
  ],
  "paragraph-lg": [
    "1.125rem",
    {
      lineHeight: "1.5rem",
      letterSpacing: "-0.015em",
      fontWeight: "400",
    },
  ],
  "paragraph-md": [
    "1rem",
    {
      lineHeight: "1.5rem",
      letterSpacing: "-0.011em",
      fontWeight: "400",
    },
  ],
  "paragraph-sm": [
    ".875rem",
    {
      lineHeight: "1.25rem",
      letterSpacing: "-0.006em",
      fontWeight: "400",
    },
  ],
  "paragraph-xs": [
    ".75rem",
    {
      lineHeight: "1rem",
      letterSpacing: "0em",
      fontWeight: "400",
    },
  ],
  "subheading-md": [
    "1rem",
    {
      lineHeight: "1.5rem",
      letterSpacing: "0.06em",
      fontWeight: "500",
    },
  ],
  "subheading-sm": [
    ".875rem",
    {
      lineHeight: "1.25rem",
      letterSpacing: "0.06em",
      fontWeight: "500",
    },
  ],
  "subheading-xs": [
    ".75rem",
    {
      lineHeight: "1rem",
      letterSpacing: "0.04em",
      fontWeight: "500",
    },
  ],
  "subheading-2xs": [
    ".6875rem",
    {
      lineHeight: ".75rem",
      letterSpacing: "0.02em",
      fontWeight: "500",
    },
  ],
  "doc-label": [
    "1.125rem",
    {
      lineHeight: "2rem",
      letterSpacing: "-0.015em",
      fontWeight: "500",
    },
  ],
  "doc-paragraph": [
    "1.125rem",
    {
      lineHeight: "2rem",
      letterSpacing: "-0.015em",
      fontWeight: "400",
    },
  ],
};

const shadows = {
  "regular-xs": "0 1px 2px 0 #0a0d1408",
  "regular-sm": "0 2px 4px #1b1c1d0a",
  "regular-md": "0 16px 32px -12px #0e121b1a",
  "button-primary-focus": [
    "0 0 0 2px theme(colors.bg[white-0])",
    "0 0 0 4px theme(colors.primary[alpha-10])",
  ],
  "button-important-focus": [
    "0 0 0 2px theme(colors.bg[white-0])",
    "0 0 0 4px theme(colors.neutral[alpha-16])",
  ],
  "button-error-focus": [
    "0 0 0 2px theme(colors.bg[white-0])",
    "0 0 0 4px theme(colors.red[alpha-10])",
  ],
  "fancy-buttons-neutral": ["0 1px 2px 0 #1b1c1d7a", "0 0 0 1px #242628"],
  "fancy-buttons-primary": [
    "0 1px 2px 0 #0e121b3d",
    "0 0 0 1px theme(colors.primary[base])",
  ],
  "fancy-buttons-error": [
    "0 1px 2px 0 #0e121b3d",
    "0 0 0 1px theme(colors.error[base])",
  ],
  "fancy-buttons-stroke": [
    "0 1px 3px 0 #0e121b1f",
    "0 0 0 1px theme(colors.stroke[soft-200])",
  ],
  "toggle-switch": ["0 6px 10px 0 #0e121b0f", "0 2px 4px 0 #0e121b08"],
  "switch-thumb": ["0 4px 8px 0 #1b1c1d0f", "0 2px 4px 0 #0e121b14"],
  tooltip: ["0 12px 24px 0 #0e121b0f", "0 1px 2px 0 #0e121b08"],
};

const borderRadii = {
  10: ".625rem",
  20: "1.25rem",
};

export const twMergeConfig = {
  extend: {
    classGroups: {
      "font-size": [
        {
          text: Object.keys(texts),
        },
      ],
      shadow: [
        {
          shadow: Object.keys(shadows),
        },
      ],
      rounded: [
        {
          rounded: Object.keys(borderRadii),
        },
      ],
    },
  },
};

const customTwMerge = extendTailwindMerge(twMergeConfig);

/**
 * Utilizes `clsx` with `tailwind-merge`, use in cases of possible class conflicts.
 */
export function cnExt(...classes: ClassValue[]) {
  return customTwMerge(clsx(...classes));
}

/**
 * A direct export of `clsx` without `tailwind-merge`.
 */
export const cn = clsx;
