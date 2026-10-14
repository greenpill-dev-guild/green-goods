import type { ElementType, HTMLAttributes } from "react";

export interface SheetHeadingProps extends HTMLAttributes<HTMLElement> {
  /**
   * The element to render. A heading level by default; `label` or `legend`
   * when the heading names a control or a group of controls.
   */
  as?: "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "label" | "legend";
  /** The control a `label` heading names. */
  htmlFor?: string;
}

/**
 * The one heading style inside a sheet body (DL-028): section headings, group
 * labels over lists, and empty, error, and success state titles render 14px
 * semibold on a 20px line in the strong text colour, in sentence case. The
 * sheet's own title and description belong to `SheetHeader`. The type lives in
 * shared `utilities.css` under `[data-component="SheetHeading"]`, so a consumer
 * adds spacing and truncation classes only.
 */
export function SheetHeading({ as = "h3", ...props }: SheetHeadingProps) {
  const Component: ElementType = as;
  return <Component data-component="SheetHeading" {...props} />;
}
