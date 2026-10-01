import type { ReactNode } from "react";

export interface FlowStepHeaderProps {
  /** Step title — rendered as the flow body's h2. */
  title: ReactNode;
  /** Optional one-line subtitle under the title. */
  description?: ReactNode;
}

/**
 * FlowStepHeader — the step title + subtitle block at the top of an action-flow
 * step body (Submit Work, Create Assessment, Create Hypercert, Seed Promises).
 * One component so the flows can't drift on heading scale: an h2 at the flow
 * title's own 22/28 size (`text-title-lg`, PRD-1022 D16), above the 16px
 * semibold section titles and 14px rows inside the step, over a `body-sm`
 * subtitle. The flow-level h1 lives in ActionFlowShell's pinned header.
 */
export function FlowStepHeader({ title, description }: FlowStepHeaderProps) {
  return (
    <div data-component="FlowStepHeader">
      <h2 className="text-title-lg font-semibold leading-[var(--type-title-lg-lh)] text-text-strong">
        {title}
      </h2>
      {description ? <p className="mt-0.5 body-sm text-text-sub">{description}</p> : null}
    </div>
  );
}

FlowStepHeader.displayName = "FlowStepHeader";
