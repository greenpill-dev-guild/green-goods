/**
 * @vitest-environment jsdom
 */

import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import type { Domain } from "@green-goods/shared/types/domain";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainContextStep } from "@/components/Assessment/CreateAssessmentSteps/DomainContextStep";

function renderDomainStep(showValidation: boolean) {
  render(
    <IntlProvider locale="en" messages={{}} onError={() => {}}>
      <DomainContextStep showValidation={showValidation} isSubmitting={false} />
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

  it("names the missing domain once validation shows", () => {
    renderDomainStep(true);

    // Title, location, and description report their own errors beside this one.
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toContain(
      "Choose a domain"
    );
  });
});
