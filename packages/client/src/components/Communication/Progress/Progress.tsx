import { cn } from "@green-goods/shared";
import { RiArrowRightSLine, RiCheckFill } from "@remixicon/react";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";

interface FormProgressProps {
  currentStep: number;
  steps: string[];
}

export const FormProgress = ({ currentStep, steps }: FormProgressProps) => {
  return (
    <div className="relative flex flex-row gap-x-2">
      {steps.map((step, index) => {
        const isCurrentStep = currentStep === index + 1;
        const isCompletedStep = currentStep > index + 1;
        return (
          <div key={step} className="flex flex-col justify-center items-center flex-1 group">
            <div className="inline-flex items-center text-xs align-middle">
              <span
                className={cn(
                  "relative grid place-items-center w-5 h-5 font-medium rounded-full transition-[color,border-color,background-color] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] border border-stroke-soft-200",
                  isCompletedStep &&
                    cn(
                      pwaStatusStyles.success.progress,
                      pwaStatusStyles.success.border,
                      "border-0"
                    ),
                  isCurrentStep &&
                    cn(
                      pwaStatusStyles.primary.border,
                      "before:absolute before:-inset-1 before:bg-primary before:rounded-full before:w-6 before:h-6 before:z-[-10] before:m-auto"
                    )
                )}
              >
                {isCompletedStep ? (
                  <RiCheckFill className={cn("w-3 h-3", pwaStatusStyles.success.foreground)} />
                ) : (
                  <div
                    className={cn(
                      isCurrentStep
                        ? pwaStatusStyles.primary.foreground
                        : pwaStatusStyles.neutral.foreground
                    )}
                  >
                    {index + 1}
                  </div>
                )}
              </span>
              <div
                className={cn(
                  currentStep > index + 1
                    ? pwaStatusStyles.success.progress
                    : pwaStatusStyles.neutral.progress,
                  "ms-2 w-full h-px flex-1 group-last:hidden"
                )}
              />
              {index < steps.length - 1 && (
                <div>
                  <RiArrowRightSLine className="w-4 text-text-soft-400" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
