import type { ReactNode } from "react";

export interface FlowStepHeaderProps {
  /** Step title — rendered as the flow body's h2. */
  title: ReactNode;
  /** Optional one-line subtitle under the title. */
  description?: ReactNode;
}

/**
 * FlowStepHeader — the step title + subtitle block at the top of an action-flow
 * step body (Submit Work, Create Assessment, Create Hypercert). One component
 * so the three flows can't drift on heading scale: h2 `text-base font-semibold`
 * over a `text-sm` subtitle, inside the step's `space-y-4` reading column.
 * The flow-level h1 lives in ActionFlowShell's pinned header, not here.
 */
export function FlowStepHeader({ title, description }: FlowStepHeaderProps) {
  return (
    <div data-component="FlowStepHeader">
      <h2 className="text-base font-semibold text-text-strong">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-text-sub">{description}</p> : null}
    </div>
  );
}

FlowStepHeader.displayName = "FlowStepHeader";
