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

const mockNavigate = vi.fn();
const mockOnSubmit = vi.fn();
const mockCreateAnother = vi.fn();
const mockCheckConfirmation = vi.fn();

// Where the flow stands: a test moves it to the Review and through its send.
const controllerState = vi.hoisted(() => ({
  currentStep: 0,
  isSending: false,
  isSent: false,
  hasError: false,
  isPendingRegistration: false,
}));

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

vi.mock("@green-goods/shared/hooks/admin-ui/actions/useCreateActionController", () => ({
  useCreateActionController: () => ({
    currentStep: controllerState.currentStep,
    domainOptions: [],
    errorMessage: "User rejected the request.",
    errorTitle: "Transaction cancelled",
    form: {
      handleSubmit: (handler: (data: Record<string, unknown>) => void) => () => handler({}),
    },
    goToStep: vi.fn(),
    handleBack: vi.fn(),
    handleCancel: () => mockNavigate("/actions"),
    handleCreateAnother: mockCreateAnother,
    handleDiscard: vi.fn(),
    handleNext: vi.fn(),
    hasError: controllerState.hasError,
    isDirty: false,
    isSending: controllerState.isSending,
    isSent: controllerState.isSent,
    isPendingRegistration: controllerState.isPendingRegistration,
    isCheckingConfirmation: false,
    checkConfirmation: mockCheckConfirmation,
    confirmWalletCancellation: vi.fn(),
    onSubmit: mockOnSubmit,
    txErrorView: { severity: "warning" },
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

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Mock step components to keep tests lightweight
vi.mock("@/components/Action/CreateActionSteps", () => ({
  BasicsStep: () => React.createElement("div", { "data-testid": "basics-step" }, "Basics Step"),
  CapitalsStep: () =>
    React.createElement("div", { "data-testid": "capitals-step" }, "Capitals Step"),
  InstructionsStep: () =>
    React.createElement("div", { "data-testid": "instructions-step" }, "Instructions Step"),
  ReviewStep: ({ status }: { status: { title: string; description: string } }) =>
    React.createElement(
      "div",
      { "data-testid": "review-step" },
      React.createElement("p", null, status.title),
      React.createElement("p", null, status.description)
    ),
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

vi.mock("@/components/AdminDialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/AdminDialog")>()),
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

vi.mock("@/components/DiscardChangesDialog", () => ({ DiscardChangesDialog: () => null }));

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
    Object.assign(controllerState, {
      currentStep: 0,
      isSending: false,
      isSent: false,
      hasError: false,
      isPendingRegistration: false,
    });
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

  // DL-080: the flow ends on its Review, whose primary sends; the status row
  // says how the send went and the footer follows it.
  describe("the Review's send", () => {
    it("sends from the Review with Create Action and says the wallet asks once", async () => {
      controllerState.currentStep = 3;
      const user = userEvent.setup();
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByText("Registers this action on-chain")).toBeInTheDocument();
      expect(screen.getByText("Your wallet will ask you once.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Create Action" }));
      expect(mockOnSubmit).toHaveBeenCalledOnce();
    });

    it("ends a successful send on the Review with Done and Create Another", async () => {
      Object.assign(controllerState, { currentStep: 3, isSent: true });
      const user = userEvent.setup();
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByTestId("review-step")).toBeInTheDocument();
      expect(screen.getByText("Action registered")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Create Action" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Create Another" }));
      expect(mockCreateAnother).toHaveBeenCalledOnce();
      await user.click(screen.getByRole("button", { name: "Done" }));
      expect(mockNavigate).toHaveBeenCalledWith("/actions");
    });

    it("keeps a failed send on the Review with its error, Try Again and Back", async () => {
      Object.assign(controllerState, { currentStep: 3, hasError: true });
      const user = userEvent.setup();
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByText("Transaction cancelled")).toBeInTheDocument();
      expect(screen.getByText("User rejected the request.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "Try Again" }));
      expect(mockOnSubmit).toHaveBeenCalledOnce();
    });

    it("holds every button while the send works", () => {
      Object.assign(controllerState, { currentStep: 3, isSending: true });
      renderWithIntl(React.createElement(CreateAction));

      expect(screen.getByText("Registering the action")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
    });
  });
});

it("holds pending action registration with a confirmation check and no Try Again", async () => {
  vi.clearAllMocks();
  controllerState.currentStep = 3;
  controllerState.isSending = true;
  controllerState.isSent = false;
  controllerState.hasError = false;
  controllerState.isPendingRegistration = true;
  renderWithIntl(<CreateAction />);
  expect(
    screen.queryByRole("button", { name: /try again|create another/i })
  ).not.toBeInTheDocument();
  expect(screen.getByText("Transaction submitted")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /check confirmation/i }));
  expect(mockCheckConfirmation).toHaveBeenCalled();
  expect(mockOnSubmit).not.toHaveBeenCalled();
});
