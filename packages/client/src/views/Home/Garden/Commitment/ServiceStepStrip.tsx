import { cn } from "@green-goods/shared/utils/styles/cn";

export interface ServiceStripStep {
  id: string;
  label: string;
  /** `wait` is another person's step: the reader waits on them, so its bar is dashed. */
  state: "done" | "now" | "wait" | "todo";
}

/**
 * The step strip at the top of a booking sheet (V1): a bar per step, the current one dark,
 * another person's dashed, and each step named under its bar.
 */
export function ServiceStepStrip({ steps, label }: { steps: ServiceStripStep[]; label: string }) {
  return (
    <ol aria-label={label} className="flex gap-1" data-component="ServiceStepStrip">
      {steps.map((step) => (
        <li
          key={step.id}
          aria-current={step.state === "now" || step.state === "wait" ? "step" : undefined}
          data-state={step.state}
          className="flex min-w-0 flex-1 flex-col gap-1"
        >
          <span
            aria-hidden="true"
            className={cn(
              "rounded-full",
              step.state === "done"
                ? "h-1 bg-success-base"
                : step.state === "now"
                  ? "h-1 bg-text-strong-950"
                  : step.state === "wait"
                    ? "border-t-4 border-dashed border-stroke-sub-300"
                    : "h-1 bg-stroke-soft-200"
            )}
          />
          <span
            className={cn(
              "truncate type-meta-sm",
              step.state === "now" || step.state === "wait"
                ? "font-semibold text-text-strong-950"
                : "text-text-sub-600"
            )}
            title={step.label}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
