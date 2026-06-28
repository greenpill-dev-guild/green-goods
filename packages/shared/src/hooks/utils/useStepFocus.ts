import { useEffect, useRef } from "react";

/**
 * Move keyboard / screen-reader focus into the newly revealed step region
 * whenever the step changes in a multi-step flow (Submit Work, Create
 * Assessment, Create Hypercert), so users follow the flow instead of being
 * stranded on the Next button. Skips the first mount so initial focus is never
 * stolen.
 *
 * Attach the returned ref to the step container (give it `tabIndex={-1}` +
 * `outline-none`); the step heading is the ideal target where the markup allows.
 */
export function useStepFocus<T extends HTMLElement = HTMLElement>(currentStep: number) {
  const ref = useRef<T>(null);
  const prevStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevStepRef.current === null) {
      prevStepRef.current = currentStep;
      return;
    }
    if (prevStepRef.current !== currentStep) {
      prevStepRef.current = currentStep;
      ref.current?.focus();
    }
  }, [currentStep]);

  return ref;
}
