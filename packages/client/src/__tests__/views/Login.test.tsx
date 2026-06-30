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
let mockIsAuthenticated = false;
let mockAuthUserName: string | null = null;

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
  normalizePasskeyAccountIdentifier: (value: string) =>
    value.trim().replace(/^@+/, "").toLowerCase(),
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
    isAuthenticated: mockIsAuthenticated,
    isReady: true,
    smartAccountAddress: null,
    hasStoredCredential: mockHasStoredCredential,
    userName: mockAuthUserName,
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
import { toastService } from "@green-goods/shared";
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

  it("shows account creation as the primary first-install action", () => {
    renderWithRouter();

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create account");
    expect(screen.getByTestId("primary-button")).toBeDisabled();
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a wallet");
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Recover with username");
    // The passwordless callout was dropped on first-create — it duplicated the
    // cross-device hint and crowded the screen.
    expect(screen.queryByTestId("info-callout")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notice")).not.toBeInTheDocument();
  });

  it("keeps legacy local account creation when passkey server is disabled", async () => {
    const user = userEvent.setup();
    mockPasskeyServerEnabled = false;
    renderWithRouter();

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create account");
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a wallet");
    expect(screen.queryByTestId("tertiary-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notice")).not.toBeInTheDocument();

    await user.type(screen.getByTestId("username-input"), "legacyuser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockCreateAccount).toHaveBeenCalledWith("legacyuser");
    expect(mockLoginWithPasskey).not.toHaveBeenCalled();
  });

  it("shows Sign in with a wallet as secondary action", () => {
    renderWithRouter();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a wallet");
  });

  it("does not show separate-account entry before recovery has failed", () => {
    renderWithRouter();
    expect(screen.getByTestId("primary-button")).not.toHaveTextContent("Create separate account");
    expect(screen.queryByTestId("notice")).not.toBeInTheDocument();
  });

  it("opens username recovery from an explicit recovery action", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Recover with passkey");
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    // Full-recovery focus: the secondary is now a clean "Back" exit, not a
    // "Create account" nudge.
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Back");
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Sign in with a wallet");
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

    await user.click(screen.getByTestId("tertiary-button"));
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

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "testuser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockLoginWithPasskey).not.toHaveBeenCalled();
    expect(screen.getByTestId("error-message")).toHaveTextContent(/recommended browser/i);
  });

  it("maps explicit address-continuity errors to recovery guidance", async () => {
    mockAuthError = new Error("Recovered passkey did not match the expected account address");
    renderWithRouter();

    expect(await screen.findByTestId("error-message")).toHaveTextContent(/different account/i);
  });

  it("does not map unrelated address errors to address-mismatch guidance", async () => {
    mockAuthError = new Error("Address profile service temporarily unavailable");
    renderWithRouter();

    expect(await screen.findByTestId("error-message")).toHaveTextContent(/something went wrong/i);
  });

  it("does not show address continuity notice during first-time account creation", () => {
    renderWithRouter();
    expect(screen.queryByTestId("notice")).not.toBeInTheDocument();
  });

  it("requires explicit confirmation before separate account creation", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockRejectedValueOnce(new Error("No passkey credential found"));
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "missinguser");
    await user.click(screen.getByTestId("primary-button"));
    await screen.findByTestId("error-message");
    await user.click(screen.getByTestId("secondary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue to new account");
    expect(screen.getByTestId("info-callout")).toHaveTextContent(/different address/i);
    expect(mockCreateAccount).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("primary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create separate account");
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
  });

  it("creates a separate account only after confirmation", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockRejectedValueOnce(new Error("No passkey credential found"));
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "missinguser");
    await user.click(screen.getByTestId("primary-button"));
    await screen.findByTestId("error-message");
    await user.click(screen.getByTestId("secondary-button"));
    await user.click(screen.getByTestId("primary-button"));
    await user.click(screen.getByTestId("primary-button"));

    expect(mockCreateAccount).toHaveBeenCalledWith("missinguser");
  });

  it("failed recovery exposes guarded new-account confirmation path", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockRejectedValueOnce(new Error("No passkey credential found"));
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "missinguser");
    await user.click(screen.getByTestId("primary-button"));

    expect(await screen.findByTestId("error-message")).toHaveTextContent(/no passkey found/i);
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Create separate account");

    await user.click(screen.getByTestId("secondary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue to new account");
    expect(screen.getByTestId("info-callout")).toHaveTextContent(/different address/i);
  });

  it("keeps guarded recovery fallback when auth error arrives after passkey dispatch", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockResolvedValueOnce(undefined);
    const view = renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "missinguser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockLoginWithPasskey).toHaveBeenCalledWith("missinguser");

    mockAuthError = new Error("No passkey credential found");
    view.rerender(createLoginTree());

    expect(await screen.findByTestId("error-message")).toHaveTextContent(/no passkey found/i);
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

  it("offers username recovery as tertiary when the passkey server is enabled", () => {
    renderWithRouter();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Recover with username");
  });

  it("does not show a tertiary action when the passkey server is disabled", () => {
    mockPasskeyServerEnabled = false;
    renderWithRouter();
    expect(screen.queryByTestId("tertiary-button")).not.toBeInTheDocument();
  });

  it("opens username recovery and returns to one-tap sign-in", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Recover with passkey");
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Back to sign in");

    await user.click(screen.getByTestId("secondary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Sign in with passkey");
  });

  it("never exposes separate-account creation from existing-account recovery", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockRejectedValueOnce(new Error("No passkey credential found"));
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "synceduser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockLoginWithPasskey).toHaveBeenCalledWith("synceduser");
    expect(await screen.findByTestId("error-message")).toHaveTextContent(/no passkey found/i);
    // The local credential stays the same-device fallback; replacing it is
    // only offered from the no-local-cache flow.
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Back to sign in");
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Sign in with a wallet");
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

// ─── Local-fallback account surfacing ─────────────────────────────────────────
// When the hosted lookup finds nothing (or is unreachable) the auth service
// deliberately falls back to the credential cached on this device. If that
// account's name differs from what the user typed, Login must say so.

describe("Login View - fallback account surfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasStoredCredential = false;
    mockAuthError = null;
    mockPasskeyServerEnabled = true;
    mockIsAuthenticated = false;
    mockAuthUserName = null;
    mockClassifyPasskeyCeremonyContext.mockReturnValue({
      supported: true,
      rpId: "greengoods.app",
      origin: "https://greengoods.app",
    });
  });

  afterEach(() => {
    mockIsAuthenticated = false;
    mockAuthUserName = null;
    cleanup();
  });

  it("toasts when recovery lands on a different cached account", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockResolvedValueOnce(undefined);
    const view = renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "mistyped-recovery-name");
    await user.click(screen.getByTestId("primary-button"));
    expect(mockLoginWithPasskey).toHaveBeenCalledWith("mistyped-recovery-name");

    // Auth resolves via the device's cached credential under another name.
    mockIsAuthenticated = true;
    mockAuthUserName = "stored-local-user";
    view.rerender(createLoginTree());

    expect(toastService.show).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "info",
        description: expect.stringContaining("stored-local-user"),
      })
    );
  });

  it("stays quiet when the recovered account matches the typed name", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockResolvedValueOnce(undefined);
    const view = renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "Stored-Local-User");
    await user.click(screen.getByTestId("primary-button"));

    mockIsAuthenticated = true;
    mockAuthUserName = "stored-local-user";
    view.rerender(createLoginTree());

    expect(toastService.show).not.toHaveBeenCalled();
  });

  it("stays quiet when authentication did not come from a recovery attempt", () => {
    mockHasStoredCredential = true;
    const view = renderWithRouter();

    mockIsAuthenticated = true;
    mockAuthUserName = "stored-local-user";
    view.rerender(createLoginTree());

    expect(toastService.show).not.toHaveBeenCalled();
  });
});
