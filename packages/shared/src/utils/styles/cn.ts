import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The shared scale's `text-*` font-size utilities (the `--text-*` keys in
 * `theme.css`). tailwind-merge only knows the stock scale (`text-sm`, `text-lg`,
 * ...), so without this registration it read `text-label-md` as a text *colour*
 * and let any later colour class (`text-[rgb(...)]`, `text-text-sub`) replace
 * it. The type roles below replace this scale; it stays registered while the
 * app's own views still use it. Keep it in step with the `--text-*` keys in
 * `theme.css`.
 */
const FONT_SIZE_UTILITIES = [
  "title-h1",
  "title-h2",
  "title-h3",
  "title-h4",
  "title-h5",
  "title-h6",
  "label-xl",
  "label-lg",
  "label-md",
  "label-sm",
  "label-xs",
  "paragraph-xl",
  "paragraph-lg",
  "paragraph-md",
  "paragraph-sm",
  "paragraph-xs",
  "subheading-md",
  "subheading-sm",
  "subheading-xs",
  "subheading-2xs",
  "doc-label",
  "doc-paragraph",
];

/**
 * The type roles (the `type-*` utilities at the end of `theme.css`). Each sets a
 * font size with its line height, weight and tracking, so it merges with the
 * other font-size classes: the last one on an element wins.
 */
const TYPE_ROLE_CLASSES = [
  "type-title-lg",
  "type-title-md",
  "type-title-sm",
  "type-body",
  "type-label",
  "type-label-sm",
  "type-meta",
  "type-meta-sm",
  "type-field",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZE_UTILITIES }, ...TYPE_ROLE_CLASSES],
    },
  },
});

/**
 * Merges className values with Tailwind CSS classes
 * Handles conditional classes and deduplicates conflicting utilities
 */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export type { ClassValue };
