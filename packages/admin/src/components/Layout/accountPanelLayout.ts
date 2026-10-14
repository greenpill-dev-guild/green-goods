import type { SheetBodyProps } from "@green-goods/shared/components/Canvas/SheetBody";
import { cn } from "@green-goods/shared/utils/styles/cn";

/** Where an account panel renders: the side sheet, or the mobile Profile route. */
export type AccountPanelLayout = "sheet" | "page";

/**
 * Body props for an account panel in each host.
 *
 * In the side sheet the body scrolls and carries the sheet's own inset. On the
 * Profile route the page scrolls and the shell's phone gutter is already the
 * side inset, so the body keeps only its block padding. It must not clip there
 * either: a scroll container flush with the gutter cuts focus rings and shadows
 * off at its edge.
 */
export function accountPanelBodyProps(
  layout: AccountPanelLayout,
  className?: string
): Omit<SheetBodyProps, "children"> {
  if (layout === "page") {
    return {
      padded: false,
      style: { overflowX: "visible", overflowY: "visible" },
      className: cn("flex flex-col gap-4 py-5", className),
    };
  }

  return { padded: true, className: cn("flex flex-col gap-4", className) };
}
