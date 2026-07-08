import { useEffect, useRef, type ReactNode } from "react";

import { toastService } from "../Toast/toast.service";
import { cn } from "../../utils/styles/cn";

export type TransactionSuccessMode = "screen" | "toast" | "receipt" | "none";

export interface TransactionSuccessAffordanceProps {
  /**
   * How the success is surfaced:
   * - `screen` / `receipt` — render `children` inside a polite status region
   *   (the flow supplies its own visuals; `receipt` is a semantic alias for
   *   flows that show a persistent record).
   * - `toast` — fire one success toast through the two-tier toast service on
   *   the rising edge of `show`, render nothing.
   * - `none` — render nothing (flow opts out; kept so call sites can switch
   *   modes without restructuring).
   */
  mode: TransactionSuccessMode;
  /** Whether the underlying transaction has succeeded. */
  show: boolean;
  /** Toast title / accessible label for the status region. */
  title?: string;
  /** Toast body (required for toast mode to say anything meaningful). */
  message?: string;
  /** Visual content for `screen`/`receipt` modes. */
  children?: ReactNode;
  className?: string;
}

/**
 * One success affordance for the funding flows (endow/donate screen, cookie-jar
 * deposit/claim toast). Display-only by design — each flow keeps its own reset
 * callback and mutation wiring. Toast mode rides the service-owned timer policy
 * (`toast.service`), never raw library toasts, so pause/dismiss behavior stays
 * consistent app-wide.
 */
export function TransactionSuccessAffordance({
  mode,
  show,
  title,
  message,
  children,
  className,
}: TransactionSuccessAffordanceProps) {
  // Fire exactly once per rising edge of `show` (a re-render while still
  // successful must not re-toast; a reset then a new success must).
  const announcedRef = useRef(false);
  useEffect(() => {
    if (mode !== "toast") return;
    if (!show) {
      announcedRef.current = false;
      return;
    }
    if (announcedRef.current) return;
    announcedRef.current = true;
    toastService.success({
      title,
      message: message ?? title ?? "",
      context: "transaction success",
      suppressLogging: true,
    });
  }, [mode, show, title, message]);

  if (!show || mode === "toast" || mode === "none") return null;

  return (
    <div
      data-component="TransactionSuccessAffordance"
      data-mode={mode}
      role="status"
      aria-live="polite"
      aria-label={title}
      className={cn(className)}
    >
      {children}
    </div>
  );
}

TransactionSuccessAffordance.displayName = "TransactionSuccessAffordance";
