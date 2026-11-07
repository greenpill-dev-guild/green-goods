/**
 * Login View Tests
 *
 * Tests the shared login scaffold:
 * - Entry: passkey primary, wallet secondary, one different-username link
 * - Username form: one Continue action for sign-in or creation, plus Back
 * - Local-only development: explicit account creation
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
const mockLoginWithOriginalPasskey = vi.fn();
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
let mockIsReady = true;
let mockAuthUserName: string | null = null;
let mockStoredUsername: string | null = null;
let mockOriginalAddress: string | null = null;
let mockPilotAuth: Record<string, unknown> = {};

vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuth: () => ({
    loginWithPasskey: mockLoginWithPasskey,
    loginWithOriginalPasskey: mockLoginWithOriginalPasskey,
    createAccount: mockCreateAccount,
    loginWithWallet: mockLoginWithWallet,
    loginWithEmbedded: mockLoginWithEmbedded,
    isAuthenticating: false,
    isAuthenticated: mockIsAuthenticated,
    isReady: mockIsReady,
    smartAccountAddress: null,
    hasStoredCredential: mockHasStoredCredential,
    userName: mockAuthUserName,
    error: mockAuthError,
    ...mockPilotAuth,
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
  getStoredOriginalAccountAddress: () => mockOriginalAddress,
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
import en from "@green-goods/shared/i18n/en.json";
import { Login } from "../../views/Login";

const createLoginTree = (initialRoute = "/home/login", messages: Record<string, string> = {}) =>
  createElement(
    IntlProvider,
    { locale: "en", messages },
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

describe("Login View - explicit pilot enrollment", () => {
  const oldAddress = "0x1111111111111111111111111111111111111111";
  const newAddress = "0x2222222222222222222222222222222222222222";
  const operationHash = `0x${"ab".repeat(32)}`;
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady = true;
    mockIsAuthenticated = false;
    mockAuthError = null;
    mockHasStoredCredential = true;
    mockPasskeyServerEnabled = true;
    mockPilotAuth = {
      authMode: "passkey",
      passkeyAccountProfile: "kernel-0.3.1-legacy",
      smartAccountAddress: oldAddress,
      findExistingPilotAccount: vi.fn(async () => null),
      preparePilotAccount: vi.fn(async () => ({
        address: newAddress,
        previousAddress: oldAddress,
        enrolled: false,
        pending: false,
      })),
      quotePilotAccount: vi.fn(async () => ({
        operationHash,
        address: newAddress,
        chainId: 100,
        nonce: "7",
        maxCostWei: "200000000000000",
        costCeilingWei: "10000000000000000",
        expiresAt: 9999999999999,
        sponsored: true,
      })),
      confirmPilotAccount: vi.fn(async () => {}),
      cancelPilotAccountEnrollment: vi.fn(),
    };
  });
  afterEach(() => {
    cleanup();
    mockPilotAuth = {};
    mockIsAuthenticated = false;
    mockOriginalAddress = null;
  });

  it("keeps the existing passkey login before any pilot transaction ceremony", async () => {
    render(createLoginTree("/home/login?pilot=1", en));
    expect(
      screen.getByText(/sign in with your existing passkey, then review/i)
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("primary-button"));
    expect(mockLoginWithPasskey).toHaveBeenCalledWith();
    expect(mockCreateAccount).not.toHaveBeenCalled();
    expect(mockPilotAuth.preparePilotAccount).not.toHaveBeenCalled();
  });

  it("shows both addresses, old-asset notice and reviewed sponsor cost before the separate proof signature", async () => {
    mockIsAuthenticated = true;
    render(createLoginTree("/home/login?pilot=1", en));
    await userEvent.click(screen.getByRole("button", { name: "Review Pilot Account" }));
    expect(screen.getByText(oldAddress)).toBeInTheDocument();
    expect(screen.getByText(newAddress)).toBeInTheDocument();
    expect(screen.getByText(/ENS name stay with your original address/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Prepare Proof Quote" }));
    expect(screen.getByText(/member gas charge 0.*0.0002 xDAI.*0.01 xDAI/)).toBeInTheDocument();
    expect(mockPilotAuth.confirmPilotAccount).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Sign Pilot Account Proof" }));
    expect(mockPilotAuth.confirmPilotAccount).toHaveBeenCalledWith(operationHash);
  });

  it("allows keeping the original account after a declined enrollment assertion", async () => {
    mockIsAuthenticated = true;
    mockPilotAuth.preparePilotAccount = vi.fn(async () => {
      throw new Error("Passkey ceremony cancelled");
    });
    render(createLoginTree("/home/login?pilot=1", en));
    await userEvent.click(screen.getByRole("button", { name: "Review Pilot Account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Your original account is still active");
    expect(screen.getByText(oldAddress)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep Original Account" }));
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
    expect(mockPilotAuth.confirmPilotAccount).not.toHaveBeenCalled();
  });

  it("keeps the connected member wallet fallback outside Kernel enrollment", async () => {
    mockIsAuthenticated = true;
    mockPilotAuth.authMode = "wallet";
    render(createLoginTree("/home/login?pilot=1", en));
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
    expect(mockPilotAuth.preparePilotAccount).not.toHaveBeenCalled();
    expect(mockPilotAuth.findExistingPilotAccount).not.toHaveBeenCalled();
  });

  it("keeps ordinary legacy login independent of unavailable Gnosis discovery", async () => {
    mockIsAuthenticated = true;
    mockPilotAuth.findExistingPilotAccount = vi.fn(async () => {
      throw new Error("Gnosis RPC unavailable");
    });
    render(createLoginTree("/home/login", en));
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
    expect(screen.queryByText("Pilot Account")).not.toBeInTheDocument();
    expect(mockPilotAuth.findExistingPilotAccount).not.toHaveBeenCalled();
    expect(mockPilotAuth.preparePilotAccount).not.toHaveBeenCalled();
  });

  it("offers the archived original account without changing the selected profile on intent", async () => {
    mockOriginalAddress = oldAddress;
    render(createLoginTree("/home/login", en));
    expect(screen.getByText(/If your pilot account cannot be verified/)).toHaveTextContent(
      oldAddress
    );
    await userEvent.click(screen.getByRole("button", { name: "Use Original Account" }));
    expect(mockLoginWithOriginalPasskey).toHaveBeenCalledWith();
    expect(mockCreateAccount).not.toHaveBeenCalled();
    expect(mockPilotAuth.confirmPilotAccount).not.toHaveBeenCalled();
  });
});

// ─── New User (no stored credential) ─────────────────────────────────────────

describe("Login View - username entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasStoredCredential = false;
    mockIsReady = true;
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
  afterEach(cleanup);

  it("leaves cold-start rendering to the static PWA surface until auth is ready", () => {
    mockIsReady = false;
    expect(renderWithRouter().container).toBeEmptyDOMElement();
  });

  it("sets the login document title", async () => {
    renderWithRouter();
    await waitFor(() => expect(document.title).toBe("Sign in | Green Goods"));
  });

  it("offers one passkey entry for both existing and new usernames", () => {
    renderWithRouter();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue with Passkey");
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a Wallet");
    expect(screen.queryByTestId("tertiary-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("username-input")).not.toBeInTheDocument();
  });

  it("opens one username form and returns to entry via Back", async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByTestId("primary-button"));
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue");
    expect(screen.getByTestId("primary-button")).toBeDisabled();
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.getByTestId("info-message")).toHaveTextContent(/sign in.*new one.*create/i);
    expect(screen.queryByTestId("secondary-button")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("tertiary-button"));
    expect(screen.queryByTestId("username-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue with Passkey");
  });

  it.each([
    "existing-gardener",
    "new-gardener",
  ])("continues %s through the same username operation", async (username) => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByTestId("primary-button"));
    await user.type(screen.getByTestId("username-input"), username);
    await user.click(screen.getByTestId("primary-button"));
    expect(mockLoginWithPasskey).toHaveBeenCalledWith(username, { createIfMissing: true });
    expect(mockCreateAccount).not.toHaveBeenCalled();
  });

  it("keeps explicit local creation without a passkey server", async () => {
    const user = userEvent.setup();
    mockPasskeyServerEnabled = false;
    renderWithRouter();
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Create Account");
    await user.click(screen.getByTestId("primary-button"));
    expect(screen.getByTestId("info-message")).toHaveTextContent(/same-device sign-in/i);
    await user.type(screen.getByTestId("username-input"), "legacyuser");
    await user.click(screen.getByTestId("primary-button"));
    expect(mockCreateAccount).toHaveBeenCalledWith("legacyuser");
  });

  it("keeps wallet sign-in on the entry screen", async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByTestId("secondary-button"));
    expect(mockLoginWithWallet).toHaveBeenCalledOnce();
  });

  it("uses the same form copy before and after translations load", async () => {
    const readForm = async (messages: Record<string, string>) => {
      const user = userEvent.setup();
      const view = render(createLoginTree("/home/login", messages));
      await user.click(screen.getByTestId("primary-button"));
      const copy = {
        button: screen.getByTestId("primary-button").textContent,
        info: screen.getByTestId("info-message").textContent,
      };
      view.unmount();
      return copy;
    };
    expect(await readForm({})).toEqual(await readForm(en));
  });

  it("keeps a failed continuation on the same form without another creation action", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockRejectedValueOnce(new Error("No passkey credential found"));
    renderWithRouter();
    await user.click(screen.getByTestId("primary-button"));
    await user.type(screen.getByTestId("username-input"), "gardener");
    await user.click(screen.getByTestId("primary-button"));
    expect(await screen.findByTestId("error-message")).toHaveTextContent(/no passkey found/i);
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue");
    expect(screen.queryByRole("button", { name: "Create Account" })).not.toBeInTheDocument();
    await user.click(screen.getByTestId("tertiary-button"));
    expect(screen.queryByTestId("error-message")).not.toBeInTheDocument();
  });

  it("blocks an unsupported RP/origin before any ceremony", async () => {
    const user = userEvent.setup();
    mockClassifyPasskeyCeremonyContext.mockReturnValue({
      supported: false,
      reason: "rp_origin_mismatch",
      rpId: "greengoods.app",
      origin: "https://example.com",
    });
    renderWithRouter();
    await user.click(screen.getByTestId("primary-button"));
    await user.type(screen.getByTestId("username-input"), "gardener");
    await user.click(screen.getByTestId("primary-button"));
    expect(mockLoginWithPasskey).not.toHaveBeenCalled();
    expect(mockCreateAccount).not.toHaveBeenCalled();
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

  it("shows an auth error delivered after the username operation was dispatched", async () => {
    const user = userEvent.setup();
    const view = renderWithRouter();
    await user.click(screen.getByTestId("primary-button"));
    await user.type(screen.getByTestId("username-input"), "gardener");
    await user.click(screen.getByTestId("primary-button"));
    mockAuthError = new Error("No passkey credential found");
    view.rerender(createLoginTree());
    expect(await screen.findByTestId("error-message")).toHaveTextContent(/no passkey found/i);
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

  it("offers one different-username action when the passkey server is enabled", () => {
    renderWithRouter();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Use Different Username");
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

    expect(screen.getByTestId("primary-button")).toHaveTextContent("Continue");
    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.queryByTestId("secondary-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("tertiary-button")).toHaveTextContent("Back");

    await user.click(screen.getByTestId("tertiary-button"));

    // Back restores the remembered account entry without another creation action.
    expect(screen.queryByTestId("username-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("secondary-button")).toHaveTextContent("Sign in with a Wallet");
    expect(screen.getByTestId("primary-button")).toHaveTextContent("Sign in with Passkey");
  });

  it("keeps one username action for returning users after an error", async () => {
    const user = userEvent.setup();
    mockLoginWithPasskey.mockRejectedValueOnce(new Error("No passkey credential found"));
    renderWithRouter();

    await user.click(screen.getByTestId("tertiary-button"));
    await user.type(screen.getByTestId("username-input"), "synceduser");
    await user.click(screen.getByTestId("primary-button"));

    expect(mockLoginWithPasskey).toHaveBeenCalledWith("synceduser", { createIfMissing: true });
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

    await user.click(screen.getByTestId("primary-button"));
    await user.type(screen.getByTestId("username-input"), "mistyped-recovery-name");
    await user.click(screen.getByTestId("primary-button"));
    expect(mockLoginWithPasskey).toHaveBeenCalledWith("mistyped-recovery-name", {
      createIfMissing: true,
    });

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

    await user.click(screen.getByTestId("primary-button"));
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
