/**
 * Login View Tests
 *
 * Tests progressive disclosure login UI:
 * - New users: email/social primary, passkey create secondary, wallet tertiary
 * - Existing users: passkey primary, email secondary, wallet tertiary
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

// Mock Splash component to simplify testing — renders all action tiers + notice
vi.mock("@/components/Layout", () => ({
  Splash: ({
    login,
    buttonLabel,
    errorMessage,
    secondaryAction,
    tertiaryAction,
    notice,
    usernameInput,
  }: {
    login?: () => void;
    buttonLabel?: string;
    errorMessage?: string | null;
    secondaryAction?: { label: string; onSelect: () => void };
    tertiaryAction?: { label: string; onClick?: () => void };
    notice?: string;
    usernameInput?: { value: string; onChange: (e: unknown) => void; onCancel?: () => void };
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

  it("shows Continue with Email as primary action for new users", () => {
    renderWithRouter();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue with Email");
  });

  it("shows Create Passkey Account as secondary action", () => {
    renderWithRouter();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Create Passkey Account");
  });

  it("shows Connect Wallet as tertiary action", () => {
    renderWithRouter();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Connect Wallet");
  });

  it("calls loginWithEmbedded when primary (email) button clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("primary-button"));
    expect(mockLoginWithEmbedded).toHaveBeenCalled();
  });

  it("calls loginWithWallet when tertiary (wallet) button clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    expect(mockLoginWithWallet).toHaveBeenCalled();
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

    // Should return to email-primary mode
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue with Email");
    expect(screen.queryByTestId("username-input")).not.toBeInTheDocument();
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

  it("shows Continue with Email as secondary for returning users", () => {
    renderWithRouter();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Continue with Email");
  });

  it("shows Connect Wallet as tertiary for returning users", () => {
    renderWithRouter();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Connect Wallet");
  });

  it("calls loginWithPasskey when primary button clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("primary-button"));
    expect(mockLoginWithPasskey).toHaveBeenCalled();
  });

  it("calls loginWithEmbedded when secondary (email) button clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("secondary-button"));
    expect(mockLoginWithEmbedded).toHaveBeenCalled();
  });

  it("shows address continuity notice", () => {
    renderWithRouter();
    expect(screen.getByTestId("notice")).toHaveTextContent(
      "Each sign-in method creates an independent account"
    );
  });
});
