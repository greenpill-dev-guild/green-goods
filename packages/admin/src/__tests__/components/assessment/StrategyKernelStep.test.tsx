/**
 * StrategyKernelStep Component Tests
 *
 * Tests for the Strategy Kernel step of the assessment creation wizard.
 * Covers rendering, validation, form interactions, and disabled state.
 */

import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { en as enMessages } from "@green-goods/shared";

// ── Store mock state ────────────────────────────────────

const mockSetField = vi.fn();
const mockAddSmartOutcome = vi.fn();
const mockRemoveSmartOutcome = vi.fn();
const mockUpdateSmartOutcome = vi.fn();

const defaultFormState = {
  diagnosis: "",
  smartOutcomes: [{ description: "", metric: "", target: 0 }],
  cynefinPhase: 0, // CynefinPhase.CLEAR
  domain: 0, // Domain.SOLAR
};

let currentFormState = { ...defaultFormState };

vi.mock("@green-goods/shared", () => ({
  CynefinPhase: { CLEAR: 0, COMPLICATED: 1, COMPLEX: 2, CHAOTIC: 3 },
  Domain: { SOLAR: 0, AGRO: 1, EDU: 2, WASTE: 3 },
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  useCreateAssessmentStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      form: currentFormState,
      setField: mockSetField,
      addSmartOutcome: mockAddSmartOutcome,
      removeSmartOutcome: mockRemoveSmartOutcome,
      updateSmartOutcome: mockUpdateSmartOutcome,
    }),
}));

vi.mock("@remixicon/react", () => {
  const Icon = (props: unknown) => React.createElement("span", props as object);
  return new Proxy({}, { get: () => Icon });
});

import { StrategyKernelStep } from "../../../components/Assessment/CreateAssessmentSteps/StrategyKernelStep";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    React.createElement(IntlProvider, { locale: "en", messages: enMessages }, ui)
  );
}

describe("components/Assessment/CreateAssessmentSteps/StrategyKernelStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentFormState = { ...defaultFormState };
  });

  describe("rendering", () => {
    it("renders without crashing", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      expect(screen.getByText("Strategy Kernel")).toBeInTheDocument();
      expect(screen.getByText("SMART Outcomes")).toBeInTheDocument();
      expect(screen.getByText("Cynefin Phase")).toBeInTheDocument();
    });

    it("renders diagnosis textarea", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      expect(screen.getByText("Diagnosis")).toBeInTheDocument();
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
    });

    it("renders all four Cynefin phase options", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      expect(screen.getByText("Clear")).toBeInTheDocument();
      expect(screen.getByText("Complicated")).toBeInTheDocument();
      expect(screen.getByText("Complex")).toBeInTheDocument();
      expect(screen.getByText("Chaotic")).toBeInTheDocument();
    });

    it("renders Add outcome button", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      expect(screen.getByText("Add outcome")).toBeInTheDocument();
    });

    it("renders domain-specific metrics in outcome select", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      // Solar domain metrics should appear as select options
      const selects = screen.getAllByRole("combobox");
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("validation errors", () => {
    it("shows diagnosis error when showValidation is true and diagnosis is empty", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: true,
          isSubmitting: false,
        })
      );

      expect(screen.getByText("Diagnosis is required")).toBeInTheDocument();
    });

    it("shows outcome errors when showValidation is true and outcomes are empty", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: true,
          isSubmitting: false,
        })
      );

      expect(screen.getByText("Description is required")).toBeInTheDocument();
      expect(screen.getByText("Select a metric")).toBeInTheDocument();
    });

    it("does not show errors when showValidation is false", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      expect(screen.queryByText("Diagnosis is required")).not.toBeInTheDocument();
      expect(screen.queryByText("Description is required")).not.toBeInTheDocument();
    });

    it("does not show diagnosis error when diagnosis has content", () => {
      currentFormState = {
        ...defaultFormState,
        diagnosis: "The soil is degraded due to overgrazing",
      };

      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: true,
          isSubmitting: false,
        })
      );

      expect(screen.queryByText("Diagnosis is required")).not.toBeInTheDocument();
    });
  });

  describe("form interactions", () => {
    it("calls setField when diagnosis textarea changes", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "New diagnosis" } });
      expect(mockSetField).toHaveBeenCalledWith("diagnosis", "New diagnosis");
    });

    it("calls addSmartOutcome when Add outcome is clicked", async () => {
      const user = userEvent.setup();

      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      await user.click(screen.getByText("Add outcome"));
      expect(mockAddSmartOutcome).toHaveBeenCalledTimes(1);
    });

    it("calls updateSmartOutcome when outcome description changes", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      const descriptionInput = screen.getByPlaceholderText("What this outcome achieves...");
      fireEvent.change(descriptionInput, { target: { value: "Plant 200 trees" } });
      expect(mockUpdateSmartOutcome).toHaveBeenCalledWith(0, "description", "Plant 200 trees");
    });

    it("calls setField when a Cynefin phase is selected", async () => {
      const user = userEvent.setup();

      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      // Click on the Complicated radio
      const complicatedRadio = screen.getByRole("radio", {
        name: /Cynefin phase: Complicated/i,
      });
      await user.click(complicatedRadio);
      expect(mockSetField).toHaveBeenCalledWith("cynefinPhase", 1);
    });

    it("does not show remove button when only one outcome exists", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      expect(screen.queryByLabelText("Remove outcome")).not.toBeInTheDocument();
    });

    it("shows remove button and calls removeSmartOutcome when clicked", async () => {
      currentFormState = {
        ...defaultFormState,
        smartOutcomes: [
          { description: "Outcome 1", metric: "treesPlanted", target: 100 },
          { description: "Outcome 2", metric: "areaCoveredHa", target: 5 },
        ],
      };

      const user = userEvent.setup();

      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: false,
        })
      );

      const removeButtons = screen.getAllByLabelText("Remove outcome");
      expect(removeButtons).toHaveLength(2);

      await user.click(removeButtons[0]);
      expect(mockRemoveSmartOutcome).toHaveBeenCalledWith(0);
    });
  });

  describe("disabled state", () => {
    it("disables diagnosis textarea when isSubmitting is true", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: true,
        })
      );

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeDisabled();
    });

    it("disables Add outcome button when isSubmitting is true", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: true,
        })
      );

      expect(screen.getByText("Add outcome").closest("button")).toBeDisabled();
    });

    it("disables Cynefin radio inputs when isSubmitting is true", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: true,
        })
      );

      const radios = screen.getAllByRole("radio");
      for (const radio of radios) {
        expect(radio).toBeDisabled();
      }
    });

    it("disables outcome inputs when isSubmitting is true", () => {
      renderWithIntl(
        React.createElement(StrategyKernelStep, {
          showValidation: false,
          isSubmitting: true,
        })
      );

      const descriptionInput = screen.getByPlaceholderText("What this outcome achieves...");
      expect(descriptionInput).toBeDisabled();

      const selects = screen.getAllByRole("combobox");
      for (const select of selects) {
        expect(select).toBeDisabled();
      }

      const targetInput = screen.getByPlaceholderText("Target");
      expect(targetInput).toBeDisabled();
    });
  });
});
