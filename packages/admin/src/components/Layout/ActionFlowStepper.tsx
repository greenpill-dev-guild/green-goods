// Compact progress stepper for admin action flows (Submit Work / Create
// Assessment / Create Hypercert). Numbered dots + connectors in the warm
// client-PWA spirit, but rendered with admin M3/semantic tokens (no glass, no
// Inter) and kept compact so it sits inside ActionFlowShell's pinned header
// without adding vertical bulk. Lives in packages/admin so the admin Tailwind
// content scan reaches its utility classes (shared/src is not scanned here).
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
}

export function ActionFlowStepper({ steps, currentStep, onStepClick }: ActionFlowStepperProps) {
  const { formatMessage } = useIntl();
  const total = steps.length;
  // Clamp only the label lookup; controllers keep currentStep in range.
  const currentTitle = steps[Math.min(Math.max(currentStep, 1), total) - 1]?.title ?? "";

  return (
    <div data-component="ActionFlowStepper">
      <ol data-region="action-flow-stepper" className="flex items-center gap-1.5">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const completed = currentStep > stepNumber;
          const isCurrent = currentStep === stepNumber;
          const isLast = index === steps.length - 1;
          const canJump = completed && Boolean(onStepClick);

          const dot = (
            <span
              className={cn(
                "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                "transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
                completed &&
                  "border-primary-base bg-primary-base [color:rgb(var(--m3-on-primary))]",
                // Current step mirrors the admin selectable-card "selected" tint
                // (ActionChooserGrid): tinted fill, not just an outline, so "you
                // are here" reads at a glance without a decorative halo.
                isCurrent && "border-primary-base bg-primary-alpha-10 text-primary-darker",
                !completed && !isCurrent && "border-stroke-soft text-text-soft"
              )}
            >
              {completed ? <RiCheckLine className="h-3 w-3" aria-hidden /> : stepNumber}
            </span>
          );

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex min-w-0 items-center gap-1.5"
            >
              {canJump ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(stepNumber)}
                  title={step.title}
                  aria-label={step.title}
                  className="rounded-full transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-1"
                >
                  {dot}
                </button>
              ) : (
                dot
              )}
              {!isLast ? (
                // Connector: a soft track with a green fill that grows from the
                // left when the preceding step completes — momentum, in spirit
                // of the client progress bar, restrained for the cockpit.
                <span
                  aria-hidden
                  className="relative h-px w-4 flex-shrink-0 overflow-hidden bg-stroke-soft sm:w-6"
                >
                  <span
                    className={cn(
                      "absolute inset-0 origin-left bg-primary-base",
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
      <p data-region="action-flow-step-label" className="mt-1.5 text-xs font-medium text-text-soft">
        {formatMessage(
          { id: "app.common.stepProgress", defaultMessage: "Step {current} of {total} · {label}" },
          { current: currentStep, total, label: currentTitle }
        )}
      </p>
    </div>
  );
}

ActionFlowStepper.displayName = "ActionFlowStepper";
