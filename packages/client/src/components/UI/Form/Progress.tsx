import { RiArrowRightSLine, RiCheckFill } from "@remixicon/react";
import { cn } from "@/utils/styles/cn";

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
                  "relative grid place-items-center w-5 h-5 font-medium rounded-full transition-colors ease-in-out duration-50 border border-slate-200 text-white",
                  isFutureStep && "bg-primary border-0",
                  isCurrentStep &&
                    "border border-primary before:absolute before:-inset-1 before:bg-primary before:rounded-full before:w-6 before:h-6 before:z-[-10] before:m-auto "
                )}
              >
                {isFutureStep ? (
                  <RiCheckFill className="w-3 h-3 text-white" />
                ) : (
                  <div className={cn(isCurrentStep ? "text-white" : "text-black")}>{index + 1}</div>
                )}
              </span>
              <div
                className={`${currentStep > index + 1 ? "bg-primary" : "bg-slate-400"} ms-2 w-full h-px flex-1 group-last:hidden`}
              />
              {index < steps.length - 1 && (
                <div>
                  <RiArrowRightSLine className="w-4 text-slate-400" />
                </div>
              )}
            </div>
            {/* <div className="mt-3">
            <span className={`block font-medium text-lg text-teal-600`}>
              {step}
            </span>
          </div> */}
          </div>
        );
      })}
    </div>
  );
};

{
  /* <ul className="steps">
  <li className="step step-primary">Register</li>
  <li className="step step-primary">Choose plan</li>
  <li className="step">Purchase</li>
  <li className="step">Receive Product</li>
</ul> */
}
