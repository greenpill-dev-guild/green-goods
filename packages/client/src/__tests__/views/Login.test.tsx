/**
 * Login View Tests
 *
 * Tests simplified login UI:
 * - New users: wallet/AppKit primary, passkey create secondary
 * - Existing users: passkey primary, wallet/AppKit secondary
 * - Passkey creation mode toggle
 * - Address continuity notice
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { HelmetProvider } from "react-helmet-async";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock shared modules and hooks
const mockLoginWithPasskey = vi.fn();
const mockCreateAccount = vi.fn();
const mockLoginWithWallet = vi.fn();
const mockLoginWithEmbedded = vi.fn();
let mockHasStoredCredential = false;

vi.mock("@green-goods/shared", () => ({
  toastService: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    show: vi.fn(),
  },
  copyToClipboard: vi.fn(),
  useInstallGuidance: () => ({
    showInstallPrompt: false,
    scenario: null,
    installAction: null,
    dismissInstallPrompt: vi.fn(),
    openInBrowserUrl: null,
  }),
  useApp: () => ({
    platform: "unknown" as const,
    isMobile: false,
    isInstalled: false,
    wasInstalled: false,
    deferredPrompt: null,
  }),
  useAuth: () => ({
    loginWithPasskey: mockLoginWithPasskey,
    createAccount: mockCreateAccount,
    loginWithWallet: mockLoginWithWallet,
    loginWithEmbedded: mockLoginWithEmbedded,
    isAuthenticating: false,
    isAuthenticated: false,
    isReady: true,
    smartAccountAddress: null,
    hasStoredCredential: mockHasStoredCredential,
    error: null,
  }),
  debugError: vi.fn(),
  trackAuthError: vi.fn(),
  APP_NAME: "Green Goods",
}));

// Mock LoadingSplash component
vi.mock("@/views/Login/components/LoadingSplash", () => ({
  LoadingSplash: ({ loadingState, message }: { loadingState: string; message?: string }) =>
    createElement("div", { "data-testid": "loading-splash" }, message || loadingState),
}));

// Mock Splash component to simplify testing — renders all action tiers + notice + info callout
vi.mock("@/components/Layout", () => ({
  Splash: ({
    login,
    buttonLabel,
    errorMessage,
    secondaryAction,
    tertiaryAction,
    notice,
    usernameInput,
    infoCallout,
  }: {
    login?: () => void;
    buttonLabel?: string;
    errorMessage?: string | null;
    secondaryAction?: { label: string; onSelect: () => void };
    tertiaryAction?: { label: string; onClick?: () => void };
    notice?: string;
    usernameInput?: { value: string; onChange: (e: unknown) => void; onCancel?: () => void };
    infoCallout?: string;
  }) =>
    createElement(
      "div",
      { "data-testid": "splash-screen" },
      createElement(
        "button",
        {
          "data-testid": "primary-button",
          onClick: login,
          type: "button",
        },
        buttonLabel || "Create Account"
      ),
      secondaryAction &&
        createElement(
          "button",
          {
            "data-testid": "secondary-button",
            onClick: secondaryAction.onSelect,
            type: "button",
          },
          secondaryAction.label
        ),
      tertiaryAction &&
        createElement(
          "button",
          {
            "data-testid": "tertiary-button",
            onClick: tertiaryAction.onClick,
            type: "button",
          },
          tertiaryAction.label
        ),
      usernameInput &&
        createElement("input", {
          "data-testid": "username-input",
          value: usernameInput.value,
          onChange: usernameInput.onChange,
        }),
      usernameInput?.onCancel &&
        createElement(
          "button",
          {
            "data-testid": "cancel-passkey-create",
            onClick: usernameInput.onCancel,
            type: "button",
          },
          "Cancel"
        ),
      infoCallout && createElement("p", { "data-testid": "info-callout" }, infoCallout),
      notice && createElement("p", { "data-testid": "notice" }, notice),
      errorMessage && createElement("p", { "data-testid": "error-message" }, errorMessage)
    ),
}));

// Import after mocks
import { Login } from "../../views/Login";

const renderWithRouter = (initialRoute = "/login") => {
  return render(
    createElement(
      IntlProvider,
      { locale: "en", messages: {} },
      createElement(
        HelmetProvider,
        null,
        createElement(
          MemoryRouter,
          { initialEntries: [initialRoute] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: "/login/*", element: createElement(Login) }),
            createElement(Route, {
              path: "/home",
              element: createElement("div", null, "Home Page"),
            })
          )
        )
      )
    )
  );
};

// ─── New User (no stored credential) ─────────────────────────────────────────

describe("Login View - New User (progressive disclosure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasStoredCredential = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders splash screen", () => {
    renderWithRouter();
    expect(screen.getByTestId("splash-screen")).toBeInTheDocument();
  });

  it("shows Connect Wallet as primary action for new users", () => {
    renderWithRouter();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Connect Wallet");
  });

  it("shows Create Passkey Account as secondary action", () => {
    renderWithRouter();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Create Passkey Account");
  });

  it("does not show a tertiary action by default", () => {
    renderWithRouter();
    expect(screen.queryByTestId("tertiary-button")).not.toBeInTheDocument();
  });

  it("calls loginWithWallet when primary button clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("primary-button"));
    expect(mockLoginWithWallet).toHaveBeenCalled();
  });

  it("does not call loginWithEmbedded from the visible new-user actions", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("primary-button"));
    await user.click(screen.getByTestId("secondary-button"));

    expect(mockLoginWithEmbedded).not.toHaveBeenCalled();
  });

  it("shows address continuity notice", () => {
    renderWithRouter();
    expect(screen.getByTestId("notice")).toHaveTextContent(
      "Each sign-in method creates an independent account"
    );
  });

  it("toggles to passkey creation mode when secondary clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    // Click "Create Passkey Account" secondary
    await user.click(screen.getByTestId("secondary-button"));

    // Now should show username input and Create Account as primary
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create Account");
  });

  it("returns from passkey creation mode via cancel", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    // Enter passkey creation mode
    await user.click(screen.getByTestId("secondary-button"));
    expect(screen.getByTestId("username-input")).toBeInTheDocument();

    // Click cancel to go back
    await user.click(screen.getByTestId("cancel-passkey-create"));

    // Should return to wallet-primary mode
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Connect Wallet");
    expect(screen.queryByTestId("username-input")).not.toBeInTheDocument();
  });

  it("does not show passkey explainer in default new-user mode", () => {
    renderWithRouter();
    expect(screen.queryByTestId("info-callout")).not.toBeInTheDocument();
  });

  it("shows passkey explainer in passkey creation mode", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    // Toggle to passkey creation mode
    await user.click(screen.getByTestId("secondary-button"));

    expect(screen.getByTestId("info-callout")).toBeInTheDocument();
    expect(screen.getByTestId("info-callout")).toHaveTextContent(/passkey|sign in securely/i);
  });

  it("hides passkey explainer when leaving passkey creation mode", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    // Enter passkey creation mode
    await user.click(screen.getByTestId("secondary-button"));
    expect(screen.getByTestId("info-callout")).toBeInTheDocument();

    // Cancel back to default mode
    await user.click(screen.getByTestId("cancel-passkey-create"));
    expect(screen.queryByTestId("info-callout")).not.toBeInTheDocument();
  });
});

// ─── Existing User (has stored credential) ───────────────────────────────────

describe("Login View - Existing User (progressive disclosure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasStoredCredential = true;
  });

  afterEach(() => {
    mockHasStoredCredential = false;
    cleanup();
  });

  it("shows Login with Passkey as primary for returning users", () => {
    renderWithRouter();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Login with Passkey");
  });

  it("shows Connect Wallet as secondary for returning users", () => {
    renderWithRouter();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Connect Wallet");
  });

  it("does not show a tertiary action by default", () => {
    renderWithRouter();
    expect(screen.queryByTestId("tertiary-button")).not.toBeInTheDocument();
  });

  it("calls loginWithPasskey when primary button clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("primary-button"));
    expect(mockLoginWithPasskey).toHaveBeenCalled();
  });

  it("calls loginWithWallet when secondary button clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("secondary-button"));
    expect(mockLoginWithWallet).toHaveBeenCalled();
  });

  it("shows address continuity notice", () => {
    renderWithRouter();
    expect(screen.getByTestId("notice")).toHaveTextContent(
      "Each sign-in method creates an independent account"
    );
  });

  it("does not show passkey explainer for returning users", () => {
    renderWithRouter();
    expect(screen.queryByTestId("info-callout")).not.toBeInTheDocument();
  });
});
