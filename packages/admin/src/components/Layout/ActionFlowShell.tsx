// Paradigm: Command Surface — solid surfaces only (no glass), pinned chrome,
// scroll body only. The single chrome for admin action flows.
import { SheetBody } from "@green-goods/shared/components/Canvas/SheetBody";
import { SheetFooter } from "@green-goods/shared/components/Canvas/SheetFooter";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiArrowLeftLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { AdminIconButton } from "../AdminButton";
import { type ActionFlowStep, ActionFlowStepper } from "./ActionFlowStepper";

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
   * Multi-step model. When provided, the shell renders a compact horizontal
   * stepper in the header on mobile and a labelled vertical step-rail on desktop
   * (lg+). Omit for single-screen flows.
   */
  steps?: ActionFlowStep[];
  /** 1-indexed current step (1..steps.length). */
  currentStep?: number;
  /** Jump back to an already-completed step (1-indexed). */
  onStepClick?: (step: number) => void;
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
 * context + title), a body row (an optional desktop step-rail + a single
 * scrolling `SheetBody`), and an optional pinned footer (`SheetFooter`). Fills
 * its parent's height, so the footer pins whenever the parent is height-bounded —
 * true for the `AdminDialog` (`variant="flow"`) that hosts these flows.
 *
 * The stepper is owned here (not passed in) so the shell can render it both ways:
 * a compact horizontal row in the header on mobile, and a labelled vertical rail
 * on desktop that uses the width to show every step. Surfaces are solid; depth
 * comes from the hairline header border + rail divider + the `SheetFooter` raised
 * treatment, never glass — per the admin Controlled Chrome boundary.
 */
export function ActionFlowShell({
  title,
  context,
  steps,
  currentStep = 1,
  onStepClick,
  onBack,
  backLabel,
  backDisabled = false,
  layout = "dialog",
  footer,
  children,
  contentClassName,
  "aria-label": ariaLabel,
}: ActionFlowShellProps) {
  const hasSteps = Boolean(steps && steps.length > 0);

  return (
    <div
      data-component="ActionFlowShell"
      data-layout={layout}
      // `h-full` + `flex-1` fill the height-bounded AdminDialog body (centered
      // card on desktop, full-width bottom-sheet on mobile) so the footer pins.
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
          <AdminIconButton
            size="lg"
            className="mt-0.5 flex-shrink-0"
            onClick={onBack}
            disabled={backDisabled}
            label={backLabel ?? ""}
          >
            <RiArrowLeftLine />
          </AdminIconButton>
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
          {/* Mobile stepper — the desktop rail (below) takes over at lg. */}
          {hasSteps ? (
            <div className="mt-2.5 lg:hidden">
              <ActionFlowStepper
                steps={steps as ActionFlowStep[]}
                currentStep={currentStep}
                onStepClick={onStepClick}
                orientation="horizontal"
              />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop step-rail — labelled vertical stepper, only when there's room. */}
        {hasSteps ? (
          <aside
            data-region="action-flow-rail"
            className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-stroke-soft px-5 py-6 lg:flex"
          >
            <ActionFlowStepper
              steps={steps as ActionFlowStep[]}
              currentStep={currentStep}
              onStepClick={onStepClick}
              orientation="vertical"
            />
          </aside>
        ) : null}

        <SheetBody padded={false} className="min-w-0">
          <div
            data-region="action-flow-body"
            aria-label={ariaLabel}
            className={cn("mx-auto w-full px-4 py-4 sm:px-6", contentClassName ?? "max-w-3xl")}
          >
            {children}
          </div>
        </SheetBody>
      </div>

      {footer ? (
        <SheetFooter style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          {footer}
        </SheetFooter>
      ) : null}
    </div>
  );
}

ActionFlowShell.displayName = "ActionFlowShell";
