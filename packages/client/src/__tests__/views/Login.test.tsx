/**
 * Login View Tests
 *
 * Tests simplified login UI:
 * - New users: passkey-first primary (gardener-default path), wallet secondary
 * - Existing users: passkey primary, wallet secondary
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
const { mockClassifyPasskeyCeremonyContext } = vi.hoisted(() => ({
  mockClassifyPasskeyCeremonyContext: vi.fn(() => ({
    supported: true,
    rpId: "greengoods.app",
    origin: "https://greengoods.app",
  })),
}));
let mockHasStoredCredential = false;
let mockAuthError: Error | null = null;
let mockPasskeyServerEnabled = true;

vi.mock("@green-goods/shared", () => ({
  toastService: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    show: vi.fn(),
  },
  copyToClipboard: vi.fn(),
  classifyPasskeyCeremonyContext: mockClassifyPasskeyCeremonyContext,
  isPasskeyServerEnabled: () => mockPasskeyServerEnabled,
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
    error: mockAuthError,
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
    isLoginDisabled,
  }: {
    login?: () => void;
    buttonLabel?: string;
    errorMessage?: string | null;
    secondaryAction?: { label: string; onSelect: () => void };
    tertiaryAction?: { label: string; onClick?: () => void };
    notice?: string;
    usernameInput?: { value: string; onChange: (e: unknown) => void; onCancel?: () => void };
    infoCallout?: string;
    isLoginDisabled?: boolean;
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
          disabled: isLoginDisabled,
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

const createLoginTree = (initialRoute = "/home/login") =>
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
          createElement(Route, { path: "/home/login/*", element: createElement(Login) }),
          createElement(Route, {
            path: "/home",
            element: createElement("div", null, "Home Page"),
          })
        )
      )
    )
  );

const renderWithRouter = (initialRoute = "/home/login") => {
  return render(createLoginTree(initialRoute));
};

// ─── New User (no stored credential) ─────────────────────────────────────────

describe("Login View - New User (progressive disclosure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasStoredCredential = false;
    mockAuthError = null;
    mockPasskeyServerEnabled = true;
    mockClassifyPasskeyCeremonyContext.mockReturnValue({
      supported: true,
      rpId: "greengoods.app",
      origin: "https://greengoods.app",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders splash screen", () => {
    renderWithRouter();
    expect(screen.getByTestId("splash-screen")).toBeInTheDocument();
  });

  it("shows recovery as primary action when no local passkey cache exists", () => {
    renderWithRouter();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Recover with passkey");
  });

  it("keeps legacy local account creation when passkey server is disabled", async () => {
    const user = userEvent.setup();
    mockPasskeyServerEnabled = false;
    renderWithRouter();

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create your account");
    expect(screen.queryByTestId("username-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tertiary-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notice")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("primary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create account");
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a wallet");
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.queryByTestId("notice")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("cancel-passkey-create"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create your account");
    expect(screen.queryByTestId("username-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notice")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("primary-button"));
    await user.type(screen.getByTestId("username-input"), "legacyuser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockCreateAccount).toHaveBeenCalledWith("legacyuser");
    expect(mockLoginWithPasskey).not.toHaveBeenCalled();
  });

  it("shows Sign in with a wallet as secondary action", () => {
    renderWithRouter();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a wallet");
  });

  it("shows guarded separate-account entry as tertiary action", () => {
    renderWithRouter();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Create separate account");
  });

  it("shows username recovery input before lookup", () => {
    renderWithRouter();

    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.getByTestId("info-callout")).toHaveTextContent(/synced passkeys/i);
  });

  it("calls loginWithWallet when secondary button clicked from default new-user mode", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("secondary-button"));
    expect(mockLoginWithWallet).toHaveBeenCalled();
  });

  it("recovers by username through passkey login", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.type(screen.getByTestId("username-input"), "testuser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockLoginWithPasskey).toHaveBeenCalledWith("testuser");
  });

  it("blocks recovery before ceremony when the RP/origin context is unsupported", async () => {
    const user = userEvent.setup();
    mockClassifyPasskeyCeremonyContext.mockReturnValue({
      supported: false,
      reason: "rp_origin_mismatch",
      rpId: "greengoods.app",
      origin: "https://example.com",
    });
    renderWithRouter();

    await user.type(screen.getByTestId("username-input"), "testuser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockLoginWithPasskey).not.toHaveBeenCalled();
    expect(screen.getByTestId("error-message")).toHaveTextContent(/recommended browser/i);
  });

  it("shows address continuity notice", () => {
    renderWithRouter();
    expect(screen.getByTestId("notice")).toHaveTextContent(
      "Creating a separate account gives you a different address."
    );
  });

  it("requires explicit confirmation before separate account creation", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue to new account");
    expect(screen.getByTestId("info-callout")).toHaveTextContent(/different address/i);
    expect(mockCreateAccount).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("primary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create separate account");
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
  });

  it("creates a separate account only after confirmation", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.click(screen.getByTestId("primary-button"));
    await user.type(screen.getByTestId("username-input"), "newuser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockCreateAccount).toHaveBeenCalledWith("newuser");
  });

  it("failed recovery exposes guarded new-account confirmation path", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockRejectedValueOnce(new Error("No passkey credential found"));
    renderWithRouter();

    await user.type(screen.getByTestId("username-input"), "missinguser");
    await user.click(screen.getByTestId("primary-button"));

    expect(await screen.findByTestId("error-message")).toHaveTextContent(/couldn't find/i);
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Create separate account");

    await user.click(screen.getByTestId("secondary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue to new account");
    expect(screen.getByTestId("info-callout")).toHaveTextContent(/different address/i);
  });

  it("keeps guarded recovery fallback when auth error arrives after passkey dispatch", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockResolvedValueOnce(undefined);
    const view = renderWithRouter();

    await user.type(screen.getByTestId("username-input"), "missinguser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockLoginWithPasskey).toHaveBeenCalledWith("missinguser");

    mockAuthError = new Error("No passkey credential found");
    view.rerender(createLoginTree());

    expect(await screen.findByTestId("error-message")).toHaveTextContent(/couldn't find/i);
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Create separate account");
  });
});

// ─── Existing User (has stored credential) ───────────────────────────────────

describe("Login View - Existing User (progressive disclosure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasStoredCredential = true;
    mockAuthError = null;
    mockPasskeyServerEnabled = true;
  });

  afterEach(() => {
    mockHasStoredCredential = false;
    cleanup();
  });

  it("shows Sign in with passkey as primary for returning users", () => {
    renderWithRouter();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Sign in with passkey");
  });

  it("shows Sign in with a wallet as secondary for returning users", () => {
    renderWithRouter();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a wallet");
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
      "Creating a separate account gives you a different address."
    );
  });

  it("does not show passkey explainer for returning users", () => {
    renderWithRouter();
    expect(screen.queryByTestId("info-callout")).not.toBeInTheDocument();
  });
});
