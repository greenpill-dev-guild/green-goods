/**
 * @vitest-environment happy-dom
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it } from "vitest";
import { useCreateAssessmentStore } from "@green-goods/shared/stores/useCreateAssessmentStore";
import { CynefinPhase, Domain } from "@green-goods/shared/types/domain";
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

  it("keeps newly added outcomes neutral until blur or the next validation attempt", () => {
    const view = render(
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <StrategyKernelStep showValidation validationAttempt={1} isSubmitting={false} />
      </IntlProvider>
    );
    expect(screen.getByRole("textbox", { name: "Outcome" })).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Outcome" }));
    const [existing, added] = screen.getAllByRole("textbox", { name: "Outcome" });
    expect(existing).toHaveAttribute("aria-invalid", "true");
    expect(added).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.blur(added);
    expect(added).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Add Outcome" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Remove Outcome" })[0]);
    expect(screen.getAllByRole("textbox", { name: "Outcome" })[1]).not.toHaveAttribute(
      "aria-invalid",
      "true"
    );
    view.rerender(
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <StrategyKernelStep showValidation validationAttempt={2} isSubmitting={false} />
      </IntlProvider>
    );
    expect(screen.getAllByRole("textbox", { name: "Outcome" })[1]).toHaveAttribute(
      "aria-invalid",
      "true"
    );
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

  it("says under each field what it holds, on every outcome row", () => {
    useCreateAssessmentStore.setState((state) => ({
      form: {
        ...state.form,
        domain: Domain.AGRO,
        smartOutcomes: [
          { description: "Native canopy returns", metric: "treesPlanted", target: 200 },
          { description: "More native species live here", metric: "", target: 12 },
        ],
      },
    }));

    renderStrategyStep();

    // Outcome is the change, Metric what is counted, Target how much (DL-079).
    for (const outcome of screen.getAllByRole("textbox", { name: "Outcome" })) {
      expect(outcome).toHaveAccessibleDescription("The change you want to see");
    }
    for (const target of screen.getAllByRole("spinbutton", { name: "Target" })) {
      expect(target).toHaveAccessibleDescription("How much");
    }
    // A field's own error takes its line; the fields beside it keep theirs.
    const [metric, unsetMetric] = screen.getAllByRole("combobox", { name: "Metric" });
    expect(metric).toHaveAccessibleDescription("What you'll count");
    expect(unsetMetric).toHaveAccessibleDescription("Select a metric");
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

  it("keeps Add Outcome ahead of the list, where a new row cannot move it", () => {
    renderStrategyStep();

    const add = screen.getByRole("button", { name: "Add Outcome" });
    const aheadOfEveryRow = () =>
      screen
        .getAllByRole("textbox", { name: "Outcome" })
        .every(
          (outcome) => add.compareDocumentPosition(outcome) & Node.DOCUMENT_POSITION_FOLLOWING
        );
    expect(aheadOfEveryRow()).toBe(true);

    fireEvent.click(add);
    fireEvent.click(add);

    expect(useCreateAssessmentStore.getState().form.smartOutcomes).toHaveLength(3);
    expect(screen.getAllByRole("textbox", { name: "Outcome" })).toHaveLength(3);
    expect(aheadOfEveryRow()).toBe(true);
  });

  it("shows Remove on every row, held while only one outcome remains", () => {
    renderStrategyStep();

    // The column is there from the first row, so a second row shifts no field.
    expect(screen.getByRole("button", { name: "Remove Outcome" })).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: "Outcome" }), {
      target: { value: "Native canopy returns" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Outcome" }));
    const removes = screen.getAllByRole("button", { name: "Remove Outcome" });
    expect(removes).toHaveLength(2);
    fireEvent.click(removes[1]);

    expect(useCreateAssessmentStore.getState().form.smartOutcomes).toEqual([
      { description: "Native canopy returns", metric: "", target: 0 },
    ]);
    expect(screen.getByRole("button", { name: "Remove Outcome" })).toBeDisabled();
  });

  it("picks how predictable the work is from one radio group, by click or arrow key", () => {
    renderStrategyStep();

    const group = screen.getByRole("radiogroup", { name: "How Predictable Is This Work?" });
    const phase = (name: string) =>
      within(group).getByRole("radio", { name: `Cynefin phase: ${name}` });
    // Clear is the default, and the group's one tab stop.
    expect(phase("Clear")).toBeChecked();
    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.tabIndex)
    ).toEqual([0, -1, -1, -1]);

    fireEvent.click(phase("Complex"));
    expect(useCreateAssessmentStore.getState().form.cynefinPhase).toBe(CynefinPhase.COMPLEX);
    expect(phase("Complex")).toBeChecked();
    expect(phase("Clear")).not.toBeChecked();

    // Arrows move the choice with the focus, and wrap at the ends.
    fireEvent.keyDown(phase("Complex"), { key: "ArrowRight" });
    expect(useCreateAssessmentStore.getState().form.cynefinPhase).toBe(CynefinPhase.CHAOTIC);
    expect(phase("Chaotic")).toHaveFocus();
    fireEvent.keyDown(phase("Chaotic"), { key: "ArrowDown" });
    expect(useCreateAssessmentStore.getState().form.cynefinPhase).toBe(CynefinPhase.CLEAR);
    expect(phase("Clear")).toHaveFocus();
  });
});
