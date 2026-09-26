/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it } from "vitest";
import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import { Domain } from "@green-goods/shared/types/domain";
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

  it("names each part in plain words, with the method as helper text and no Solar fallback", () => {
    // A restored draft can carry a stale domain; it reads as none, never as Solar.
    useCreateAssessmentStore.setState((state) => ({
      form: { ...state.form, domain: 9 as Domain, diagnosis: "Riverbank erosion" },
    }));

    renderStrategyStep();

    expect(screen.getByRole("textbox", { name: /The challenge/ })).toBeInTheDocument();
    expect(screen.getByText(/\(the diagnosis\)$/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What You'll Measure" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "How Predictable Is This Work?" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Strategy Kernel" })).not.toBeInTheDocument();
    expect(screen.queryByText(/kWh|solar panels|rooftop/i)).not.toBeInTheDocument();
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
