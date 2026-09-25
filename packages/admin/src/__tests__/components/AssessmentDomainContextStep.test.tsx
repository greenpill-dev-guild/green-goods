/**
 * @vitest-environment jsdom
 */

import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import { Domain } from "@green-goods/shared/types/domain";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainContextStep } from "@/components/Assessment/CreateAssessmentSteps/DomainContextStep";

function renderDomainStep(showValidation: boolean, gardenDomainMask?: number) {
  render(
    <IntlProvider locale="en" messages={{}} onError={() => {}}>
      <DomainContextStep
        showValidation={showValidation}
        isSubmitting={false}
        gardenDomainMask={gardenDomainMask}
      />
    </IntlProvider>
  );
}

describe("DomainContextStep", () => {
  beforeEach(() => {
    useCreateAssessmentStore.getState().reset();
  });

  it("starts with no domain chosen and neutral text, and asks for one only after Next", () => {
    renderDomainStep(false);

    expect(
      screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked)
    ).toBe(true);
    expect(screen.queryByPlaceholderText(/Kigali|solar/i)).not.toBeInTheDocument();
    expect(
      screen.getByText("Describe the work, where it happens, and who it serves.")
    ).toBeVisible();
    expect(screen.queryByText("Choose a domain")).not.toBeInTheDocument();
  });

  it("asks again for a domain a restored draft holds but no longer exists", () => {
    // A draft saved before a domain was retired restores a number no choice matches.
    useCreateAssessmentStore.getState().setField("domain", 99 as Domain);
    renderDomainStep(true);

    expect(
      screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked)
    ).toBe(true);
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toContain(
      "Choose a domain"
    );
  });

  it("leaves a single-domain garden's domain for the steward to choose", () => {
    renderDomainStep(false, 1 << Domain.AGRO);

    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio")).not.toBeChecked();
    expect(useCreateAssessmentStore.getState().form.domain).toBeNull();
  });

  it("clears a restored domain the garden does not document", () => {
    useCreateAssessmentStore.getState().setField("domain", Domain.SOLAR);
    renderDomainStep(true, 1 << Domain.AGRO);

    expect(useCreateAssessmentStore.getState().form.domain).toBeNull();
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toContain(
      "Choose a domain"
    );
  });

  it("names the missing domain once validation shows", () => {
    renderDomainStep(true);

    // Title, location, and description report their own errors beside this one.
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toContain(
      "Choose a domain"
    );
  });
});
