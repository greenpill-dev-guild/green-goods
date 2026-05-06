/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFormWizardStepValidation } from "../../../hooks/ui/useFormWizardStepValidation";

const STEPS = [{ id: "details" }, { id: "review" }] as const;
const STEP_FIELDS = {
  details: ["name", "slug"],
  review: ["confirm"],
} as const;

describe("hooks/ui/useFormWizardStepValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the current step fields before moving next", async () => {
    const trigger = vi.fn().mockResolvedValue(true);
    const onValidNext = vi.fn();

    const { result } = renderHook(() =>
      useFormWizardStepValidation({
        currentStep: 0,
        steps: STEPS,
        stepFields: STEP_FIELDS,
        trigger,
        onValidNext,
      })
    );

    await act(async () => {
      await result.current.handleNext();
    });

    expect(trigger).toHaveBeenCalledWith(["name", "slug"], { shouldFocus: true });
    expect(onValidNext).toHaveBeenCalledTimes(1);
    expect(result.current.showValidation).toBe(true);
  });

  it("does not move next when current step validation fails", async () => {
    const trigger = vi.fn().mockResolvedValue(false);
    const onValidNext = vi.fn();

    const { result } = renderHook(() =>
      useFormWizardStepValidation({
        currentStep: 1,
        steps: STEPS,
        stepFields: STEP_FIELDS,
        trigger,
        onValidNext,
      })
    );

    await act(async () => {
      await result.current.handleNext();
    });

    expect(trigger).toHaveBeenCalledWith(["confirm"], { shouldFocus: true });
    expect(onValidNext).not.toHaveBeenCalled();
    expect(result.current.showValidation).toBe(true);
  });

  it("validates all fields on submit checks", async () => {
    const trigger = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useFormWizardStepValidation({
        currentStep: 0,
        steps: STEPS,
        stepFields: STEP_FIELDS,
        trigger,
        onValidNext: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.validateAll();
    });

    expect(trigger).toHaveBeenCalledWith(undefined, { shouldFocus: true });
    expect(result.current.showValidation).toBe(true);
  });

  it("clears validation when navigating backward or clicking another step", () => {
    const onBack = vi.fn();
    const onStepClick = vi.fn();

    const { result } = renderHook(() =>
      useFormWizardStepValidation({
        currentStep: 0,
        steps: STEPS,
        onValidNext: vi.fn(),
        onBack,
        onStepClick,
      })
    );

    act(() => {
      result.current.setShowValidation(true);
    });
    expect(result.current.showValidation).toBe(true);

    act(() => {
      result.current.handleBack();
    });
    expect(result.current.showValidation).toBe(false);
    expect(onBack).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setShowValidation(true);
      result.current.handleStepClick(1);
    });
    expect(result.current.showValidation).toBe(false);
    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it("resets validation when the current step changes", () => {
    const { result, rerender } = renderHook(
      ({ currentStep }) =>
        useFormWizardStepValidation({
          currentStep,
          steps: STEPS,
          onValidNext: vi.fn(),
        }),
      { initialProps: { currentStep: 0 } }
    );

    act(() => {
      result.current.setShowValidation(true);
    });
    expect(result.current.showValidation).toBe(true);

    rerender({ currentStep: 1 });

    expect(result.current.showValidation).toBe(false);
  });
});
