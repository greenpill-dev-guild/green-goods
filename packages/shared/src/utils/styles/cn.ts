import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The project's custom `text-*` font-size utilities. tailwind-merge only knows
 * the stock scale (`text-sm`, `text-lg`, ...), so without this registration it
 * read `text-body-sm` or `text-label-lg` as a text *colour* and let any later
 * colour class (`text-[rgb(...)]`, `text-text-sub`) replace it — the admin field
 * label, tab, and chip labels all lost their size that way. Keep this list in
 * step with the `--text-*` keys in `theme.css` and `packages/admin/src/index.css`.
 */
const FONT_SIZE_UTILITIES = [
  "display-lg",
  "display-md",
  "display-sm",
  "headline-lg",
  "headline-md",
  "headline-sm",
  "title-lg",
  "title-md",
  "title-sm",
  "title-h1",
  "title-h2",
  "title-h3",
  "title-h4",
  "title-h5",
  "title-h6",
  "body-lg",
  "body-md",
  "body-sm",
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

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZE_UTILITIES }],
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
