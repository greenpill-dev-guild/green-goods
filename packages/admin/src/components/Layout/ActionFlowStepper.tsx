// Compact progress stepper for admin action flows (Submit Work / Create
// Assessment / Create Hypercert). Numbered dots + connectors in the warm
// client-PWA spirit, but rendered with admin M3/semantic tokens (no glass, no
// Inter) and kept compact so it sits inside ActionFlowShell's pinned header
// without adding vertical bulk. Lives in packages/admin so the admin Tailwind
// content scan reaches its utility classes (shared/src is not scanned here).
import { cn } from "@green-goods/shared";
import { RiCheckLine } from "@remixicon/react";

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
  return (
    <ol
      data-component="ActionFlowStepper"
      data-region="action-flow-stepper"
      className="flex items-center gap-1.5"
    >
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
              completed && "border-primary-base bg-primary-base [color:rgb(var(--m3-on-primary))]",
              isCurrent && "border-primary-base text-primary-base",
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
              <span
                aria-hidden
                className={cn(
                  "h-px w-4 flex-shrink-0 sm:w-6",
                  completed ? "bg-primary-base" : "bg-stroke-soft"
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

ActionFlowStepper.displayName = "ActionFlowStepper";
