import { RiArrowRightSLine, RiCheckFill } from "@remixicon/react";
import { cn } from "@green-goods/shared/utils";

interface FormProgressProps {
  currentStep: number;
  steps: string[];
}

export const FormProgress = ({ currentStep, steps }: FormProgressProps) => {
  return (
    <div className="relative flex flex-row gap-x-2">
      {steps.map((step, index) => {
        const isCurrentStep = currentStep === index + 1;
        const isFutureStep = currentStep > index + 1;
        return (
          <div key={step} className="flex flex-col justify-center items-center flex-1 group">
            <div className="inline-flex items-center text-xs align-middle">
              <span
                className={cn(
                  "relative grid place-items-center w-5 h-5 font-medium rounded-full transition-colors ease-in-out duration-50 border border-stroke-soft-200",
                  isFutureStep && "bg-primary border-0",
                  isCurrentStep &&
                    "border border-primary before:absolute before:-inset-1 before:bg-primary before:rounded-full before:w-6 before:h-6 before:z-[-10] before:m-auto "
                )}
              >
                {isFutureStep ? (
                  <RiCheckFill className="w-3 h-3 text-primary-foreground" />
                ) : (
                  <div
                    className={cn(
                      isCurrentStep ? "text-primary-foreground" : "text-text-strong-950"
                    )}
                  >
                    {index + 1}
                  </div>
                )}
              </span>
              <div
                className={`${currentStep > index + 1 ? "bg-primary" : "bg-bg-soft-200"} ms-2 w-full h-px flex-1 group-last:hidden`}
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
