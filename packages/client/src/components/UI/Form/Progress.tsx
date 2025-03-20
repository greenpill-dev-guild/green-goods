import { cn } from "@/utils/cn";
import { RiCheckFill, RiArrowRightSLine } from "@remixicon/react";

interface FormProgressProps {
  currentStep: number;
  steps: string[];
}

export const FormProgress = ({ currentStep, steps }: FormProgressProps) => {
  return (
    <div className="relative flex flex-row gap-x-2">
      {steps.map((step, index) => (
        <div
          key={step}
          className="flex flex-col justify-center items-center flex-1 group"
        >
          <div className="inline-flex items-center text-sm align-middle">
            <span
              className={cn(
                "relative grid place-items-center w-7 h-7 font-medium rounded-full transition-colors ease-in-out duration-300 border border-slate-200 text-black",
                currentStep > index + 1 && "bg-primary border-0",
                currentStep === index + 1 &&
                  "bg-primary text-white before:absolute before:-inset-1 before:bg-primary before:rounded-full before:w-13 before:h-13 before:z-[-1] before:m-auto border-0"
              )}
            >
              {currentStep > index + 1 ? (
                <RiCheckFill className="w-5 h-5 text-white" />
              ) : (
                index + 1
              )}
            </span>
            <div
              className={`${currentStep > index + 1 ? "bg-primary" : "bg-slate-400"} ms-2 w-full h-px flex-1 group-last:hidden`}
            />
            {index < steps.length -1 && <div><RiArrowRightSLine className="w-5 text-slate-400"/></div>}
          </div>
          {/* <div className="mt-3">
            <span className={`block font-medium text-lg text-teal-600`}>
              {step}
            </span>
          </div> */}
        </div>
      ))}
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
