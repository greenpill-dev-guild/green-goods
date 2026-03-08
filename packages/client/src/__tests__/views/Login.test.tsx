/**
 * Login View Smoke Tests
 *
 * Tests that the Login view renders without crashing and handles auth states.
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

// Mock Splash component to simplify testing
vi.mock("@/components/Layout", () => ({
  Splash: ({
    login,
    buttonLabel,
    errorMessage,
    secondaryAction,
    tertiaryAction,
  }: {
    login?: () => void;
    buttonLabel?: string;
    errorMessage?: string | null;
    secondaryAction?: { label: string; onSelect: () => void };
    tertiaryAction?: { label: string; onClick?: () => void };
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

describe("Login View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders splash screen", () => {
    renderWithRouter();

    expect(screen.getByTestId("splash-screen")).toBeInTheDocument();
  });

  it("shows Create Account button for new users", () => {
    renderWithRouter();

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create Account");
  });

  it("shows Login with Wallet secondary button", () => {
    renderWithRouter();

    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Login with Wallet");
  });

  it("calls loginWithWallet when secondary button clicked", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("secondary-button"));

    expect(mockLoginWithWallet).toHaveBeenCalled();
  });
});

describe("Login View - Existing User", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasStoredCredential = true;
  });

  afterEach(() => {
    mockHasStoredCredential = false;
    cleanup();
  });

  it("shows Login with Passkey button when user has stored credentials", () => {
    renderWithRouter();

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Login with Passkey");
  });

  it("calls loginWithPasskey when primary button clicked for existing user", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("primary-button"));

    expect(mockLoginWithPasskey).toHaveBeenCalled();
  });
});
