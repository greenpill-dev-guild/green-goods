// Paradigm: Command Surface — solid surfaces only (no glass), pinned chrome,
// scroll body only. The single chrome for admin action flows.
import { cn, SheetBody, SheetFooter } from "@green-goods/shared";
import { RiArrowLeftLine } from "@remixicon/react";
import type { ReactNode } from "react";

export interface ActionFlowShellProps {
  /** Sticky title (e.g. "Submit work"). */
  title: string;
  /**
   * Caps context line above the title (e.g. garden name). The focused dialog/
   * route is detached from the AppBar GardenChip, so naming its scope here is
   * allowed (Frontend Rule 17 — chrome is absent in this surface).
   */
  context?: ReactNode;
  /**
   * Compact progress stepper (e.g. <ActionFlowStepper />) shown under the title
   * for multi-step flows. Omit it for single-screen flows.
   */
  stepper?: ReactNode;
  /**
   * In-flow back (e.g. configure → qualify). When provided, a back-arrow renders
   * in the header. Omit it on the first phase so the only way out is the dialog
   * close / route back link the caller owns.
   */
  onBack?: () => void;
  /** Accessible label + tooltip for the back-arrow. Required when `onBack` is set. */
  backLabel?: string;
  /** Disables the back-arrow while protected work is in flight (media prep / tx). */
  backDisabled?: boolean;
  /**
   * "dialog" reserves header right padding for AdminDialog's own close button.
   * "page" assumes the route owns exit via its back link, so no reservation.
   */
  layout?: "dialog" | "page";
  /** Pinned footer (progress slot + actions). Omitted phases (e.g. qualify) pass none. */
  footer?: ReactNode;
  /** Scrollable body content. Rendered inside a centered reading column. */
  children: ReactNode;
  /** Override the reading-column max width (default `max-w-3xl`). */
  contentClassName?: string;
  /** Live status label for the body region (`aria-live`). */
  "aria-label"?: string;
}

/**
 * ActionFlowShell — the shared chrome for admin action flows (Submit Work,
 * Create Assessment, Create Hypercert). Renders a pinned header (back-arrow +
 * context + title), a single scrolling body (`SheetBody`), and an optional
 * pinned footer (`SheetFooter`). Fills its parent's height, so the footer pins
 * whenever the parent is height-bounded — true for the centered 2xl `AdminDialog`
 * (`variant="flow"`) that hosts these flows: a centered card on desktop, a
 * bottom-sheet on mobile.
 *
 * Surfaces are solid; depth comes from the hairline header border and the
 * `SheetFooter` raised treatment, never glass — per the admin Controlled Chrome
 * boundary. There is intentionally no second header here: the caller renders the
 * outer `AdminDialog`, and this is the only title bar.
 */
export function ActionFlowShell({
  title,
  context,
  stepper,
  onBack,
  backLabel,
  backDisabled = false,
  layout = "dialog",
  footer,
  children,
  contentClassName,
  "aria-label": ariaLabel,
}: ActionFlowShellProps) {
  return (
    <div
      data-component="ActionFlowShell"
      data-layout={layout}
      // `h-full` + `flex-1` fill the height-bounded AdminDialog body (centered
      // card on desktop, bottom-sheet on mobile) so the footer pins.
      className="flex h-full min-h-0 flex-1 flex-col bg-[rgb(var(--m3-surface))]"
    >
      <header
        data-region="action-flow-header"
        className={cn(
          "flex shrink-0 items-start gap-3 px-4 py-3 sm:px-6",
          "border-b border-stroke-soft",
          // Reserve room for the AdminDialog close button (top-right).
          layout === "dialog" && "pr-14"
        )}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={backDisabled}
            aria-label={backLabel}
            title={backLabel}
            className={cn(
              "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
              "border border-stroke-soft text-text-soft",
              "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
              "hover:text-text-sub active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-text-soft disabled:active:scale-100"
            )}
          >
            <RiArrowLeftLine className="h-5 w-5" aria-hidden />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          {context ? (
            <p
              data-region="action-flow-context"
              className="truncate text-xs font-medium text-text-soft"
              title={typeof context === "string" ? context : undefined}
            >
              {context}
            </p>
          ) : null}
          <h1 className="truncate text-lg font-semibold text-text-strong" title={title}>
            {title}
          </h1>
          {stepper ? <div className="mt-2.5">{stepper}</div> : null}
        </div>
      </header>

      <SheetBody padded={false} className="min-w-0">
        <div
          data-region="action-flow-body"
          aria-label={ariaLabel}
          className={cn("mx-auto w-full px-4 py-4 sm:px-6", contentClassName ?? "max-w-3xl")}
        >
          {children}
        </div>
      </SheetBody>

      {footer ? <SheetFooter data-region="action-flow-footer">{footer}</SheetFooter> : null}
    </div>
  );
}

ActionFlowShell.displayName = "ActionFlowShell";
