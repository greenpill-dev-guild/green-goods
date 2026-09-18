/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it } from "vitest";
import { Domain, useCreateAssessmentStore } from "@green-goods/shared";
import { StrategyKernelStep } from "@/components/Assessment/CreateAssessmentSteps/StrategyKernelStep";

function renderStrategyStep() {
  render(
    <IntlProvider locale="en" messages={{}} onError={() => {}}>
      <StrategyKernelStep showValidation isSubmitting={false} />
    </IntlProvider>
  );
}

describe("StrategyKernelStep", () => {
  beforeEach(() => {
    useCreateAssessmentStore.getState().reset();
  });

  it("explains persisted duplicate metric selections", () => {
    useCreateAssessmentStore.setState((state) => ({
      form: {
        ...state.form,
        domain: Domain.SOLAR,
        diagnosis: "Rural households need clean energy access.",
        smartOutcomes: [
          { description: "Generate clean power", metric: "kwhGenerated", target: 500 },
          { description: "Raise production baseline", metric: "kwhGenerated", target: 650 },
        ],
      },
    }));

    renderStrategyStep();

    expect(screen.getAllByText("Each metric can only be used once per assessment")).toHaveLength(2);
  });

  it("prevents selecting a metric already used by another outcome", () => {
    useCreateAssessmentStore.setState((state) => ({
      form: {
        ...state.form,
        domain: Domain.SOLAR,
        smartOutcomes: [
          { description: "Generate clean power", metric: "kwhGenerated", target: 500 },
          { description: "Install local panels", metric: "", target: 50 },
        ],
      },
    }));

    renderStrategyStep();

    const selects = screen.getAllByRole("combobox");
    expect(
      within(selects[1]).getByRole("option", { name: "Energy generated (kWh)" })
    ).toBeDisabled();
    expect(
      within(selects[1]).getByRole("option", { name: "Panels installed (panels)" })
    ).not.toBeDisabled();
  });
});
