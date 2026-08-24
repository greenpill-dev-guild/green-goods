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
import { default as enMessages } from "@green-goods/shared/i18n/en.json";

// ── Mock state ──────────────────────────────────────────

const mockRegisterAction = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@green-goods/shared/components/Button", () => ({
  Button: ({
    children,
    loading,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) =>
    React.createElement("button", props, loading ? "Loading..." : children),
}));

vi.mock("@green-goods/shared/components/ErrorBoundary/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@green-goods/shared/components/Form/StepIndicator", () => ({
  StepIndicator: () => null,
}));

vi.mock("@green-goods/shared/components/Surface/Surface", () => ({
  Surface: ({
    as: Component = "div",
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) =>
    React.createElement(Component, props, children),
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { loading: vi.fn(), dismiss: vi.fn(), error: vi.fn() },
}));

vi.mock("@green-goods/shared/config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

vi.mock("@green-goods/shared/config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

vi.mock("@green-goods/shared/config/domain", () => ({
  DOMAIN_CONFIG: {
    0: { labelId: "app.domain.tab.solar" },
    1: { labelId: "app.domain.tab.agro" },
    2: { labelId: "app.domain.tab.education" },
    3: { labelId: "app.domain.tab.waste" },
  },
}));

vi.mock("@green-goods/shared/hooks/action/useActionForm", () => ({
  createActionSchema: {
    // Minimal Zod-compatible schema mock for zodResolver
    _def: { typeName: "ZodObject" },
    safeParseAsync: vi.fn().mockResolvedValue({ success: true, data: {} }),
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
    parseAsync: vi.fn().mockResolvedValue({}),
    parse: vi.fn().mockReturnValue({}),
    spa: vi.fn().mockResolvedValue({ success: true, data: {} }),
  },
}));

vi.mock("@green-goods/shared/hooks/action/useActionOperations", () => ({
  useActionOperations: () => ({
    registerAction: mockRegisterAction,
    isLoading: false,
  }),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/actions/actions.utils", () => ({
  getActionsListSearch: () => ({}),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/actions/useCreateActionController", () => ({
  useCreateActionController: () => ({
    currentStep: 0,
    domainOptions: [],
    form: {
      handleSubmit: (handler: (data: Record<string, unknown>) => void) => () => handler({}),
    },
    goToStep: vi.fn(),
    handleBack: vi.fn(),
    handleCancel: () => mockNavigate("/actions"),
    handleDiscard: vi.fn(),
    handleNext: vi.fn(),
    isDirty: false,
    isLoading: false,
    onSubmit: vi.fn(),
    stepConfigs: [
      { id: "basics", title: "Basics", description: "Title and timeline" },
      { id: "capitals", title: "Capitals & Media", description: "Forms of capital and images" },
      { id: "instructions", title: "Instructions", description: "Define work submission form" },
      { id: "review", title: "Review", description: "Confirm and submit" },
    ],
  }),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/useDirtyClose", () => ({
  useDirtyClose: () => ({
    onOpenChange: vi.fn(),
    confirmOpen: false,
    cancelClose: vi.fn(),
    confirmClose: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/hooks/ui/useFormWizardStepValidation", () => ({
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
}));

vi.mock("@green-goods/shared/hooks/utils/useStepFocus", () => ({
  useStepFocus: () => ({ current: null }),
}));

vi.mock("@green-goods/shared/i18n/en.json", () => ({
  default: {},
}));

vi.mock("@green-goods/shared/modules/app/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared/modules/app/logger")>();
  return {
    ...actual,
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  };
});

vi.mock("@green-goods/shared/modules/data/ipfs/upload", () => ({
  uploadFileToIPFS: vi.fn(),
}));

vi.mock("@green-goods/shared/stores/useSheetOrchestratorStore", () => ({
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
}));

vi.mock("@green-goods/shared/types/domain", () => ({
  Domain: { SOLAR: 0, AGRO: 1, EDU: 2, WASTE: 3 },
}));

vi.mock("@green-goods/shared/utils/action/templates", () => ({
  defaultTemplate: {
    title: "Work Submission",
    description: "",
    feedbackPlaceholder: "",
    inputs: [],
  },
}));

vi.mock("@green-goods/shared/utils/navigation/admin-routes", () => ({
  adminRoutes: {
    actions: () => "/actions",
  },
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
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

// Mock the flow chrome — the wizard grammar is exercised by ActionFlowShell's
// own tests; here we only assert CreateAction wires the active step + footer.
vi.mock("@/components/Layout/ActionFlowShell", () => ({
  ActionFlowShell: ({
    title,
    children,
    footer,
  }: {
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      null,
      React.createElement("h1", null, title),
      React.createElement("div", null, children),
      React.createElement("div", null, footer)
    ),
}));

vi.mock("@/components/Layout/FlowStepHeader", () => ({
  FlowStepHeader: ({ title }: { title: React.ReactNode }) => React.createElement("h2", null, title),
}));

vi.mock("@/components/AdminDialog", () => ({
  AdminDialog: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { role: "dialog" }, children),
  ADMIN_FLOW_DIALOG_CLASS: "",
}));

vi.mock("@/components/AdminButton", () => ({
  AdminButton: ({
    children,
    onClick,
    loading,
    type = "button",
    disabled,
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) =>
    React.createElement("button", { type, onClick, disabled }, loading ? "Loading..." : children),
}));

vi.mock("@/components/AdminLinearProgress", () => ({ AdminLinearProgress: () => null }));
vi.mock("@/components/DiscardChangesDialog", () => ({ DiscardChangesDialog: () => null }));

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

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
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
    it("renders only the active step (Basics), not later steps", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByTestId("basics-step")).toBeInTheDocument();
      expect(screen.queryByTestId("capitals-step")).not.toBeInTheDocument();
      expect(screen.queryByTestId("instructions-step")).not.toBeInTheDocument();
      expect(screen.queryByTestId("review-step")).not.toBeInTheDocument();
    });

    it("renders the active step heading only", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByRole("heading", { name: "Basics" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Review" })).not.toBeInTheDocument();
    });

    it("renders stepped navigation: Next + Cancel on the first step, no Back", () => {
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    });
  });

  describe("cancel", () => {
    it("navigates to /actions when Cancel is clicked on the first step", async () => {
      const user = userEvent.setup();
      renderWithIntl(React.createElement(CreateAction));

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mockNavigate).toHaveBeenCalledWith("/actions");
    });
  });
});
