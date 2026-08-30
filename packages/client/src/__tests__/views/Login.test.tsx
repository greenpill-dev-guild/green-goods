/**
 * Login View Tests
 *
 * Tests the three-screen login model on one scaffold:
 * - Entry: primary (Create account / personalized Continue as), wallet
 *   secondary, Recover link
 * - Create form (two-step: entry → form): input, Create account, Back
 * - Recover form (flat: recover or Back — no separate-account fork)
 * - Shared message zone (info/helper vs error)
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
const { mockClassifyPasskeyCeremonyContext, mockToastService } = vi.hoisted(() => ({
  mockClassifyPasskeyCeremonyContext: vi.fn(() => ({
    supported: true,
    reason: undefined as "rp_origin_mismatch" | undefined,
    rpId: "greengoods.app",
    origin: "https://greengoods.app",
  })),
  mockToastService: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    show: vi.fn(),
  },
}));
let mockHasStoredCredential = false;
let mockAuthError: Error | null = null;
let mockPasskeyServerEnabled = true;
let mockIsAuthenticated = false;
let mockAuthUserName: string | null = null;
let mockStoredUsername: string | null = null;

vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
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
}));

vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: () => ({
    platform: "unknown" as const,
    isMobile: false,
    isInstalled: false,
    isInstalling: false,
    wasInstalled: false,
    deferredPrompt: null,
  }),
}));

vi.mock("@green-goods/shared/hooks/app/useInstallGuidance", () => ({
  useInstallGuidance: () => ({
    showInstallPrompt: false,
    scenario: null,
    installAction: null,
    dismissInstallPrompt: vi.fn(),
    openInBrowserUrl: null,
  }),
}));

vi.mock("@green-goods/shared/config/passkeyServer", () => ({
  classifyPasskeyCeremonyContext: mockClassifyPasskeyCeremonyContext,
  isPasskeyServerEnabled: () => mockPasskeyServerEnabled,
  normalizePasskeyAccountIdentifier: (value: string) =>
    value.trim().replace(/^@+/, "").toLowerCase(),
}));

vi.mock("@green-goods/shared/modules/auth/session", () => ({
  getStoredUsername: () => mockStoredUsername,
}));
vi.mock("@green-goods/shared/modules/app/error-categories", () => ({
  trackAuthError: vi.fn(),
}));
vi.mock("@green-goods/shared/utils/app/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));
vi.mock("@green-goods/shared/utils/debug", () => ({
  debugError: vi.fn(),
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    toastService: mockToastService,
  };
});

// Mock LoadingSplash component (boot state only)
vi.mock("@/views/Login/components/LoadingSplash", () => ({
  LoadingSplash: ({ loadingState, message }: { loadingState: string; message?: string }) =>
    createElement("div", { "data-testid": "loading-splash" }, message || loadingState),
}));

// Mock Splash component to simplify testing — renders all action tiers + the
// shared message zone (error wins over info, mirroring the real component)
vi.mock("@/components/Layout", () => ({
  Splash: ({
    login,
    buttonLabel,
    buttonTitle,
    errorMessage,
    secondaryAction,
    tertiaryAction,
    usernameInput,
    infoMessage,
    isLoginDisabled,
  }: {
    login?: () => void;
    buttonLabel?: string;
    buttonTitle?: string;
    errorMessage?: string | null;
    secondaryAction?: { label: string; onSelect: () => void };
    tertiaryAction?: { label: string; onClick?: () => void };
    usernameInput?: { value: string; onChange: (e: unknown) => void; onCancel?: () => void };
    infoMessage?: string;
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
          title: buttonTitle,
        },
        buttonLabel || "Create Account"
      ),
      // Mirrors the real component: the secondary renders on entry screens only.
      !usernameInput &&
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
      infoMessage &&
        !errorMessage &&
        createElement("p", { "data-testid": "info-message" }, infoMessage),
      errorMessage && createElement("p", { "data-testid": "error-message" }, errorMessage)
    ),
}));

// Import after mocks
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
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

describe("Login View - New User (two-step create)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasStoredCredential = false;
    mockAuthError = null;
    mockPasskeyServerEnabled = true;
    mockStoredUsername = null;
    mockClassifyPasskeyCeremonyContext.mockReturnValue({
      supported: true,
      reason: undefined,
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

  it("sets the login document title", async () => {
    renderWithRouter();
    await waitFor(() => expect(document.title).toBe("Sign in | Green Goods"));
  });

  it("shows the entry screen without an input: create, wallet, recover", () => {
    renderWithRouter();

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create Account");
    expect(screen.getByTestId("primary-button")).toBeEnabled();
    expect(screen.queryByTestId("username-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a Wallet");
    // First-timers get the reframed "existing account" link, not "Recover…";
    // recovery-by-username still exists for existing users on a new device.
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Already have an account?");
    expect(screen.queryByTestId("info-message")).not.toBeInTheDocument();
  });

  it("opens the create form from the entry primary and returns via Back", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("primary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create Account");
    expect(screen.getByTestId("primary-button")).toBeDisabled();
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    // Form screens drop the wallet secondary; Back is the tertiary.
    expect(screen.queryByTestId("secondary-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Back");
    // The input's visible instruction lives in the shared message zone.
    expect(screen.getByTestId("info-message")).toHaveTextContent(/synced passkey/i);

    await user.click(screen.getByTestId("tertiary-button"));

    expect(screen.queryByTestId("username-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a Wallet");
  });

  it("creates an account from the create form", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("primary-button"));
    await user.type(screen.getByTestId("username-input"), "newgardener");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockCreateAccount).toHaveBeenCalledWith("newgardener");
    expect(mockLoginWithPasskey).not.toHaveBeenCalled();
  });

  it("keeps legacy local account creation when passkey server is disabled", async () => {
    const user = userEvent.setup();
    mockPasskeyServerEnabled = false;
    renderWithRouter();

    // Entry: no recover link without a passkey server.
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create Account");
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a Wallet");
    expect(screen.queryByTestId("tertiary-button")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("primary-button"));

    // Local-only mode keeps the re-enrollment explainer in the message zone.
    expect(screen.getByTestId("info-message")).toHaveTextContent(/same-device sign-in/i);

    await user.type(screen.getByTestId("username-input"), "legacyuser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockCreateAccount).toHaveBeenCalledWith("legacyuser");
  });

  it("calls loginWithWallet from the entry secondary", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("secondary-button"));
    expect(mockLoginWithWallet).toHaveBeenCalled();
  });

  it("opens the recover form from the entry recover link", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Recover with passkey");
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    // Flat sub-flow: no wallet, no fork — just Back.
    expect(screen.queryByTestId("secondary-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Back");
    expect(screen.getByTestId("info-message")).toHaveTextContent(/synced passkeys/i);
  });

  it("recovers by username through passkey login", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "testuser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockLoginWithPasskey).toHaveBeenCalledWith("testuser");
  });

  it("failed recovery shows the error with no separate-account fork", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockRejectedValueOnce(new Error("No passkey credential found"));
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "missinguser");
    await user.click(screen.getByTestId("primary-button"));

    expect(await screen.findByTestId("error-message")).toHaveTextContent(/no passkey found/i);
    // Recovery is flat: the user retries or goes Back — nothing else appears.
    expect(screen.queryByTestId("secondary-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Back");
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Recover with passkey");

    // Back returns to the entry screen where a fresh account can be created.
    await user.click(screen.getByTestId("tertiary-button"));
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create Account");
    expect(screen.queryByTestId("error-message")).not.toBeInTheDocument();
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

  it("shows the recovery error when the auth error arrives after passkey dispatch", async () => {
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
    expect(screen.queryByTestId("secondary-button")).not.toBeInTheDocument();
  });
});

// ─── Existing User (has stored credential) ───────────────────────────────────

describe("Login View - Existing User (entry screen)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasStoredCredential = true;
    mockAuthError = null;
    mockPasskeyServerEnabled = true;
    mockStoredUsername = null;
  });

  afterEach(() => {
    mockHasStoredCredential = false;
    cleanup();
  });

  it("shows Sign in with passkey as primary for returning users", () => {
    renderWithRouter();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Sign in with Passkey");
    expect(screen.queryByTestId("username-input")).not.toBeInTheDocument();
  });

  it("personalizes the primary with the stored username", () => {
    mockStoredUsername = "gardener.eth";
    renderWithRouter();
    const primary = screen.getByTestId("primary-button");
    expect(primary).toHaveTextContent("Continue as gardener.eth");
    // Full label doubles as the hover title for when the pill truncates.
    expect(primary).toHaveAttribute("title", "Continue as gardener.eth");
  });

  it("falls back to the generic label when the stored username is blank", () => {
    mockStoredUsername = "   ";
    renderWithRouter();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Sign in with Passkey");
  });

  it("shows Sign in with a wallet as secondary for returning users", () => {
    renderWithRouter();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a Wallet");
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

  it("opens the recover form and returns to one-tap sign-in via Back", async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Recover with passkey");
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.queryByTestId("secondary-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Back");

    await user.click(screen.getByTestId("tertiary-button"));

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Sign in with Passkey");
  });

  it("keeps recovery flat for returning users too", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockRejectedValueOnce(new Error("No passkey credential found"));
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "synceduser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockLoginWithPasskey).toHaveBeenCalledWith("synceduser");
    expect(await screen.findByTestId("error-message")).toHaveTextContent(/no passkey found/i);
    expect(screen.queryByTestId("secondary-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Back");
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

  it("keeps the message zone empty on the entry screen", () => {
    renderWithRouter();
    expect(screen.queryByTestId("info-message")).not.toBeInTheDocument();
    expect(screen.queryByTestId("error-message")).not.toBeInTheDocument();
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
    mockStoredUsername = null;
    mockClassifyPasskeyCeremonyContext.mockReturnValue({
      supported: true,
      reason: undefined,
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
