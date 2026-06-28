// Progress stepper for admin action flows (Submit Work / Create Assessment /
// Create Hypercert). Two orientations from the same step model:
//   • horizontal — compact numbered dots + connectors + a "Step N of M · Label"
//     line. Sits in the ActionFlowShell header on mobile.
//   • vertical — a labelled rail (dot + step title per row). Sits in the
//     ActionFlowShell left rail on desktop, using the width to show every step.
// Accent follows the workspace tone (Hub blue / Garden green / …) when inside a
// `data-tone` dialog, falling back to green elsewhere — same token pattern as
// AdminButton. Lives in packages/admin so the admin Tailwind scan reaches its
// utility classes (shared/src is not scanned here).
import { cn } from "@green-goods/shared";
import { RiCheckLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface ActionFlowStep {
  id: string;
  title: string;
}

export interface ActionFlowStepperProps {
  steps: ActionFlowStep[];
  /** 1-indexed current step (1..steps.length), matching the flow controllers. */
  currentStep: number;
  /** Jump back to an already-completed step. Receives the 1-indexed step. */
  onStepClick?: (step: number) => void;
  /** "horizontal" (compact, mobile header) | "vertical" (labelled desktop rail). */
  orientation?: "horizontal" | "vertical";
}

const DOT_BASE =
  "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]";

// Tone-aware dot states. Inside a `data-tone` dialog `--tone-action` resolves to
// the per-view hue; elsewhere it falls back to the green `--primary-action`.
function dotClasses(completed: boolean, isCurrent: boolean) {
  return cn(
    DOT_BASE,
    completed &&
      "border-[rgb(var(--tone-action,var(--primary-action)))] bg-[rgb(var(--tone-action,var(--primary-action)))] [color:rgb(var(--tone-on-action,var(--primary-action-foreground)))]",
    isCurrent &&
      "border-[rgb(var(--tone-action,var(--primary-action)))] bg-[rgb(var(--tone-action,var(--primary-action))/0.1)] text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]",
    !completed && !isCurrent && "border-stroke-soft text-text-sub"
  );
}

// `p-3 -m-3` nets to zero in the flex layout (margin-box unchanged) while the
// border-box grows to a 44px tap target around the 20px dot — keeps the visual
// dot + spacing intact, just enlarges the touch/click + focus-ring area for the
// mobile completed-step jump (WCAG 2.5.5).
const JUMP_CLASS =
  "-m-3 rounded-full p-3 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-action,var(--primary-action)))] focus-visible:ring-offset-1";

export function ActionFlowStepper({
  steps,
  currentStep,
  onStepClick,
  orientation = "horizontal",
}: ActionFlowStepperProps) {
  const { formatMessage } = useIntl();
  const total = steps.length;
  // Clamp only the label lookup; controllers keep currentStep in range.
  const currentTitle = steps[Math.min(Math.max(currentStep, 1), total) - 1]?.title ?? "";

  const renderDot = (
    step: ActionFlowStep,
    stepNumber: number,
    completed: boolean,
    isCurrent: boolean
  ) => {
    const dot = (
      <span className={dotClasses(completed, isCurrent)}>
        {completed ? <RiCheckLine className="h-3 w-3" aria-hidden /> : stepNumber}
      </span>
    );
    if (completed && onStepClick) {
      return (
        <button
          type="button"
          onClick={() => onStepClick(stepNumber)}
          title={step.title}
          aria-label={step.title}
          className={JUMP_CLASS}
        >
          {dot}
        </button>
      );
    }
    return dot;
  };

  if (orientation === "vertical") {
    return (
      <ol data-component="ActionFlowStepper" data-orientation="vertical" className="flex flex-col">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const completed = currentStep > stepNumber;
          const isCurrent = currentStep === stepNumber;
          const isLast = index === total - 1;
          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex min-w-0 gap-3"
            >
              <div className="flex flex-col items-center">
                {renderDot(step, stepNumber, completed, isCurrent)}
                {!isLast ? (
                  // Vertical connector — fills the gap to the next dot, tinted once
                  // the step completes (matches the horizontal fill direction).
                  <span
                    aria-hidden
                    className={cn(
                      "my-1 w-0.5 flex-1 transition-colors duration-[var(--spring-effects-duration)] ease-[var(--spring-effects-easing)]",
                      completed
                        ? "bg-[rgb(var(--tone-action,var(--primary-action)))]"
                        : "bg-stroke-soft"
                    )}
                  />
                ) : null}
              </div>
              <div className={cn("min-w-0 pt-0.5", !isLast && "pb-5")}>
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    isCurrent
                      ? "text-[rgb(var(--tone-on-surface-accent,var(--m3-primary)))]"
                      : completed
                        ? "text-text-strong"
                        : "text-text-sub"
                  )}
                  title={step.title}
                >
                  {step.title}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div data-component="ActionFlowStepper" data-orientation="horizontal">
      <ol data-region="action-flow-stepper" className="flex items-center gap-1.5">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const completed = currentStep > stepNumber;
          const isCurrent = currentStep === stepNumber;
          const isLast = index === total - 1;
          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex min-w-0 items-center gap-1.5"
            >
              {renderDot(step, stepNumber, completed, isCurrent)}
              {!isLast ? (
                <span
                  aria-hidden
                  className="relative h-0.5 w-4 flex-shrink-0 overflow-hidden bg-stroke-soft sm:w-6"
                >
                  <span
                    className={cn(
                      "absolute inset-0 origin-left bg-[rgb(var(--tone-action,var(--primary-action)))]",
                      "transition-transform duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)]",
                      completed ? "scale-x-100" : "scale-x-0"
                    )}
                  />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p data-region="action-flow-step-label" className="mt-1.5 text-xs font-medium text-text-sub">
        {formatMessage(
          { id: "app.common.stepProgress", defaultMessage: "Step {current} of {total} · {label}" },
          { current: currentStep, total, label: currentTitle }
        )}
      </p>
    </div>
  );
}

ActionFlowStepper.displayName = "ActionFlowStepper";
