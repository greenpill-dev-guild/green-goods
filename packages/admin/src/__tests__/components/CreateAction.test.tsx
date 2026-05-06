/**
 * CreateAction View Tests
 *
 * Tests for the create action form flow.
 * Covers rendering and local form actions.
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
  getActionsListSearch: () => ({}),
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
  Button: ({
    children,
    loading,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) =>
    React.createElement("button", props, loading ? "Loading..." : children),
  Surface: ({
    as: Component = "div",
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) =>
    React.createElement(Component, props, children),
  useCreateActionController: () => ({
    currentStep: 0,
    domainOptions: [],
    form: {
      handleSubmit: (handler: (data: Record<string, unknown>) => void) => () => handler({}),
    },
    handleBack: vi.fn(),
    handleCancel: () => mockNavigate("/actions"),
    handleNext: vi.fn(),
    isLoading: false,
    onSubmit: vi.fn(),
    stepConfigs: [
      { id: "basics", title: "Basics", description: "Title and timeline" },
      { id: "capitals", title: "Capitals & Media", description: "Forms of capital and images" },
      { id: "instructions", title: "Instructions", description: "Define work submission form" },
      { id: "review", title: "Review", description: "Confirm and submit" },
    ],
  }),
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
  });

  describe("rendering", () => {
    it("renders all form flow sections", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByTestId("basics-step")).toBeInTheDocument();
      expect(screen.getByTestId("capitals-step")).toBeInTheDocument();
      expect(screen.getByTestId("instructions-step")).toBeInTheDocument();
      expect(screen.getByTestId("review-step")).toBeInTheDocument();
    });

    it("renders section titles from the create action steps", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByRole("heading", { name: "Basics" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Capitals & Media" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Instructions" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    });

    it("does not render wizard navigation controls", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    });
  });

  describe("cancel", () => {
    it("navigates to /actions when Cancel is clicked", async () => {
      const user = userEvent.setup();
      renderWithIntl(React.createElement(CreateAction));

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mockNavigate).toHaveBeenCalledWith("/actions");
    });
  });
});
