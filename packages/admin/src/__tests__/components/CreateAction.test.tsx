/**
 * CreateAction View Tests
 *
 * Tests for the create action form wizard flow.
 * Covers rendering, step navigation, and submit button state.
 */

import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { en as enMessages } from "@green-goods/shared";

// ── Mock state ──────────────────────────────────────────

const mockRegisterAction = vi.fn();
const mockNavigate = vi.fn();
let capturedProps: Record<string, unknown> = {};

vi.mock("@green-goods/shared", () => ({
  DEFAULT_CHAIN_ID: 42161,
  Domain: { SOLAR: 0, AGRO: 1, EDU: 2, WASTE: 3 },
  DOMAIN_CONFIG: {
    0: { labelId: "app.domain.tab.solar" },
    1: { labelId: "app.domain.tab.agro" },
    2: { labelId: "app.domain.tab.education" },
    3: { labelId: "app.domain.tab.waste" },
  },
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  adminRoutes: {
    actions: () => "/actions",
  },
  en: {},
  createActionSchema: {
    // Minimal Zod-compatible schema mock for zodResolver
    _def: { typeName: "ZodObject" },
    safeParseAsync: vi.fn().mockResolvedValue({ success: true, data: {} }),
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
    parseAsync: vi.fn().mockResolvedValue({}),
    parse: vi.fn().mockReturnValue({}),
    spa: vi.fn().mockResolvedValue({ success: true, data: {} }),
  },
  defaultTemplate: {
    title: "Work Submission",
    description: "",
    feedbackPlaceholder: "",
    inputs: [],
  },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  toastService: { loading: vi.fn(), dismiss: vi.fn(), error: vi.fn() },
  uploadFileToIPFS: vi.fn(),
  useActionOperations: () => ({
    registerAction: mockRegisterAction,
    isLoading: false,
  }),
  useSheetOrchestratorStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        setFormState: vi.fn(),
        clearViewState: vi.fn(),
        restoreViewState: vi.fn(() => null),
      }),
    {
      getState: () => ({
        setFormState: vi.fn(),
        clearViewState: vi.fn(),
        restoreViewState: vi.fn(() => null),
      }),
    }
  ),
  useFormWizardStepValidation: ({
    currentStep,
    steps,
    stepFields,
    trigger,
    onValidNext,
    onBack,
    onStepClick,
  }: {
    currentStep: number;
    steps: Array<{ id: string }>;
    stepFields?: Record<string, string[]>;
    trigger?: (fields?: string[], options?: { shouldFocus?: boolean }) => Promise<boolean>;
    onValidNext: () => void;
    onBack?: () => void;
    onStepClick?: (stepIndex: number) => void;
  }) => {
    const [showValidation, setShowValidation] = React.useState(false);
    React.useEffect(() => setShowValidation(false), [currentStep]);

    const validateCurrentStep = async () => {
      setShowValidation(true);
      const fields = stepFields?.[steps[currentStep]?.id ?? ""];
      if (!trigger || !fields?.length) return true;
      return trigger(fields, { shouldFocus: true });
    };

    return {
      showValidation,
      setShowValidation,
      validateCurrentStep,
      validateAll: async () => (trigger ? trigger(undefined, { shouldFocus: true }) : true),
      handleNext: async () => {
        if (await validateCurrentStep()) onValidNext();
      },
      handleBack: () => {
        setShowValidation(false);
        onBack?.();
      },
      handleStepClick: (stepIndex: number) => {
        setShowValidation(false);
        onStepClick?.(stepIndex);
      },
    };
  },
  FormWizard: (props: {
    steps: Array<{ id: string; title: string }>;
    currentStep: number;
    onNext?: () => void;
    onBack?: () => void;
    onCancel: () => void;
    onSubmit?: () => void;
    isSubmitting?: boolean;
    children: React.ReactNode;
  }) => {
    capturedProps = props;
    const isLastStep = props.currentStep === props.steps.length - 1;
    return React.createElement(
      "div",
      { "data-testid": "form-wizard" },
      React.createElement(
        "div",
        { "data-testid": "step-indicator" },
        `Step ${props.currentStep + 1} of ${props.steps.length}`
      ),
      props.children,
      props.currentStep > 0 &&
        React.createElement(
          "button",
          { onClick: props.onBack, "data-testid": "back-button" },
          "Back"
        ),
      !isLastStep &&
        props.onNext &&
        React.createElement(
          "button",
          { onClick: props.onNext, "data-testid": "next-button" },
          "Continue"
        ),
      isLastStep &&
        props.onSubmit &&
        React.createElement(
          "button",
          {
            onClick: props.onSubmit,
            disabled: props.isSubmitting,
            "data-testid": "submit-button",
          },
          props.isSubmitting ? "Submitting…" : "Submit"
        ),
      React.createElement(
        "button",
        { onClick: props.onCancel, "data-testid": "cancel-button" },
        "Cancel"
      )
    );
  },
  StepIndicator: () => null,
}));

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => async () => ({ values: {}, errors: {} }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
      React.createElement("a", { href: to, ...props }, children),
  };
});

// Mock step components to keep tests lightweight
vi.mock("@/components/Action/CreateActionSteps", () => ({
  BasicsStep: () => React.createElement("div", { "data-testid": "basics-step" }, "Basics Step"),
  CapitalsStep: () =>
    React.createElement("div", { "data-testid": "capitals-step" }, "Capitals Step"),
  InstructionsStep: () =>
    React.createElement("div", { "data-testid": "instructions-step" }, "Instructions Step"),
  ReviewStep: () => React.createElement("div", { "data-testid": "review-step" }, "Review Step"),
}));

vi.mock("@remixicon/react", () => {
  const Icon = (props: unknown) => React.createElement("span", props as object);
  return new Proxy({}, { get: () => Icon });
});

vi.mock("@/components/Layout/PageHeader", () => ({
  PageHeader: ({ title, description }: { title: string; description?: React.ReactNode }) =>
    React.createElement(
      "div",
      {},
      React.createElement("h1", {}, title),
      description ? React.createElement("p", {}, description) : null
    ),
}));

vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { MemoryRouter } from "react-router-dom";
import CreateAction from "../../views/Actions/CreateAction";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    React.createElement(
      IntlProvider,
      { locale: "en", messages: enMessages },
      React.createElement(MemoryRouter, null, ui)
    )
  );
}

describe("views/Actions/CreateAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProps = {};
  });

  describe("rendering", () => {
    it("renders the form wizard", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByTestId("form-wizard")).toBeInTheDocument();
    });

    it("starts on the first step (Basics)", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByTestId("basics-step")).toBeInTheDocument();
      expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    });

    it("passes four steps to the wizard", () => {
      renderWithIntl(React.createElement(CreateAction));

      const steps = capturedProps.steps as Array<{ id: string }>;
      expect(steps).toHaveLength(4);
      expect(steps.map((s) => s.id)).toEqual(["basics", "capitals", "instructions", "review"]);
    });

    it("shows Continue button on first step", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByTestId("next-button")).toBeInTheDocument();
    });

    it("does not show Back button on first step", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
    });
  });

  describe("step navigation", () => {
    it("advances to Capitals step when Continue is clicked", async () => {
      const user = userEvent.setup();
      renderWithIntl(React.createElement(CreateAction));

      await user.click(screen.getByTestId("next-button"));

      expect(screen.getByTestId("capitals-step")).toBeInTheDocument();
      expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    });

    it("goes back to Basics step when Back is clicked", async () => {
      const user = userEvent.setup();
      renderWithIntl(React.createElement(CreateAction));

      // Navigate forward
      await user.click(screen.getByTestId("next-button"));
      expect(screen.getByTestId("capitals-step")).toBeInTheDocument();

      // Navigate back
      await user.click(screen.getByTestId("back-button"));
      expect(screen.getByTestId("basics-step")).toBeInTheDocument();
    });

    it("navigates through all four steps", async () => {
      const user = userEvent.setup();
      renderWithIntl(React.createElement(CreateAction));

      // Step 1 -> 2
      await user.click(screen.getByTestId("next-button"));
      expect(screen.getByTestId("capitals-step")).toBeInTheDocument();

      // Step 2 -> 3
      await user.click(screen.getByTestId("next-button"));
      expect(screen.getByTestId("instructions-step")).toBeInTheDocument();

      // Step 3 -> 4 (last step shows Submit)
      await user.click(screen.getByTestId("next-button"));
      expect(screen.getByTestId("review-step")).toBeInTheDocument();
      expect(screen.getByTestId("submit-button")).toBeInTheDocument();
    });
  });

  describe("cancel", () => {
    it("navigates to /actions when Cancel is clicked", async () => {
      const user = userEvent.setup();
      renderWithIntl(React.createElement(CreateAction));

      await user.click(screen.getByTestId("cancel-button"));
      expect(mockNavigate).toHaveBeenCalledWith("/actions");
    });
  });

  describe("submit state", () => {
    it("passes isSubmitting=false to the wizard by default", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(capturedProps.isSubmitting).toBe(false);
    });
  });
});
