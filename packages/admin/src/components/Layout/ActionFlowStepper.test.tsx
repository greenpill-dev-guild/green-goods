import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import enMessages from "../../../../shared/src/i18n/en.json";
import { ActionFlowStepper, type ActionFlowStep } from "./ActionFlowStepper";

const STEPS: ActionFlowStep[] = [
  { id: "action", title: "Action" },
  { id: "media", title: "Media" },
  { id: "details", title: "Details" },
  { id: "review", title: "Review" },
];

function renderStepper(currentStep: number) {
  return render(
    <IntlProvider locale="en" messages={enMessages}>
      <ActionFlowStepper steps={STEPS} currentStep={currentStep} />
    </IntlProvider>
  );
}

describe("ActionFlowStepper", () => {
  it("renders the orientation label naming the current step", () => {
    renderStepper(2);
    // "Step {current} of {total} · {label}" — the journey anchor near the dots.
    const label = screen.getByText(/Step 2 of 4/);
    expect(label).toHaveTextContent("Media");
  });

  it("marks the current step with aria-current and its number", () => {
    const { container } = renderStepper(2);
    const current = container.querySelector('[aria-current="step"]');
    expect(current).not.toBeNull();
    expect(current).toHaveTextContent("2");
  });

  it("updates the label as the flow advances", () => {
    const { rerender } = renderStepper(1);
    expect(screen.getByText(/Step 1 of 4/)).toHaveTextContent("Action");

    rerender(
      <IntlProvider locale="en" messages={enMessages}>
        <ActionFlowStepper steps={STEPS} currentStep={4} />
      </IntlProvider>
    );
    expect(screen.getByText(/Step 4 of 4/)).toHaveTextContent("Review");
  });

  it("vertical orientation lists every step's label", () => {
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <ActionFlowStepper steps={STEPS} currentStep={2} orientation="vertical" />
      </IntlProvider>
    );
    for (const step of STEPS) {
      expect(screen.getByText(step.title)).toBeInTheDocument();
    }
  });
});
