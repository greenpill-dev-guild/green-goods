import {
  RiCheckboxCircleFill,
  RiErrorWarningFill,
  RiInformationLine,
  RiLoader4Line,
} from "@remixicon/react";

import { cn } from "../../utils/styles/cn";
import type { ToastStatus } from "./toast.service";

// The public website's editorial toast keeps its icon in the deep editorial ink.
const EDITORIAL_ICON_CLASS =
  "[.gg-toast-editorial_&]:text-[rgb(var(--editorial-deep-rgb,45_33_24))]";

/**
 * The status icon a toast shows on its title's line (D23): Remix glyphs on the
 * status tokens, so they follow the theme. The text and the live region carry
 * the status, so the icon is hidden from assistive technology. A loading toast's
 * spinner is what says it is working.
 */
export function ToastStatusIcon({ status }: { status: ToastStatus }) {
  const className = cn("h-5 w-5 shrink-0", EDITORIAL_ICON_CLASS);
  switch (status) {
    case "success":
      return (
        <RiCheckboxCircleFill aria-hidden="true" className={cn(className, "text-success-base")} />
      );
    case "error":
      return <RiErrorWarningFill aria-hidden="true" className={cn(className, "text-error-base")} />;
    case "loading":
      return (
        <RiLoader4Line
          aria-hidden="true"
          className={cn(className, "animate-spin text-text-sub-600")}
        />
      );
    default:
      return (
        <RiInformationLine aria-hidden="true" className={cn(className, "text-information-base")} />
      );
  }
}
