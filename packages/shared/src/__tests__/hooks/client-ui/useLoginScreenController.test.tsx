/**
 * The login screen controller decides three things before or after a passkey ceremony: a display
 * name under three characters never starts one, a recovery that signs in to a different account
 * says which account it got, and a finished login goes to the right place.
 */

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toastService } from "../../../components/Toast/toast.service";
import { useLoginScreenController } from "../../../hooks/client-ui/auth/useLoginScreenController";
import enMessages from "../../../i18n/en.json";

const auth = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock("../../../hooks/auth/useAuth", () => ({ useAuth: () => auth.current }));
vi.mock("../../../providers/App", () => ({
  useApp: () => ({
    platform: "unknown",
    isMobile: false,
    isInstalling: false,
    wasInstalled: false,
    installedAppEvidence: null,
    deferredPrompt: null,
  }),
}));
vi.mock("../../../config/passkeyServer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/passkeyServer")>()),
  classifyPasskeyCeremonyContext: () => ({ supported: true }),
  isPasskeyServerEnabled: () => true,
}));

const routes = { login: "/login", home: "/home" };

function renderController(entry: string | { pathname: string; state?: unknown } = "/login") {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>
      <IntlProvider locale="en" messages={enMessages}>
        {children}
      </IntlProvider>
    </MemoryRouter>
  );
  return renderHook(() => useLoginScreenController(routes), { wrapper });
}

beforeEach(() => {
  auth.current = {
    isAuthenticated: false,
    isAuthenticating: false,
    userName: undefined,
    error: null,
    hasStoredCredential: false,
    loginWithPasskey: vi.fn(async () => undefined),
    createAccount: vi.fn(async () => undefined),
    loginWithWallet: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useLoginScreenController", () => {
  it.each([
    {
      flow: "recover",
      setName: "setRecoveryUsername",
      run: "recoverWithPasskey",
      ceremony: "loginWithPasskey",
    },
    { flow: "create", setName: "setUsername", run: "createAccount", ceremony: "createAccount" },
  ] as const)("refuses a two-letter display name before any $flow ceremony", async ({
    setName,
    run,
    ceremony,
  }) => {
    const { result } = renderController();

    act(() => result.current[setName]("  ab  "));
    await act(async () => result.current[run]());

    expect(result.current.loginError).toBe("Display name must be at least 3 characters.");
    expect(auth.current[ceremony]).not.toHaveBeenCalled();
  });

  it("says no account was created when the prompt closes on a new account, and only then", async () => {
    const closed = Object.assign(new Error("The operation was not allowed."), {
      name: "NotAllowedError",
    });
    const { result, rerender } = renderController();

    act(() => result.current.setUsername("ada"));
    await act(async () => result.current.createAccount());
    auth.current = { ...auth.current, error: closed };
    rerender();
    expect(result.current.loginError).toBe("No account was created. Try again.");

    // The next attempt is a sign-in: the same dismissal reads as a cancelled sign-in again.
    await act(async () => result.current.loginWithPasskey());
    auth.current = { ...auth.current, error: Object.assign(new Error(closed.message), closed) };
    rerender();
    expect(result.current.loginError).toBe("Sign in was cancelled.");
  });

  it("tells the user when recovery signed in to a different account than the one they named", async () => {
    const show = vi.spyOn(toastService, "show").mockReturnValue("fallback");
    const { result, rerender } = renderController();

    act(() => result.current.setRecoveryUsername("alice"));
    await act(async () => result.current.recoverWithPasskey());
    expect(auth.current.loginWithPasskey).toHaveBeenCalledWith("alice");
    auth.current = { ...auth.current, isAuthenticated: true, userName: "bob" };
    rerender();

    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0][0]).toMatchObject({
      status: "info",
      description: expect.stringMatching(/alice.*bob/),
    });
  });

  it("stays quiet when recovery signs in to the named account, however it was typed", async () => {
    const show = vi.spyOn(toastService, "show").mockReturnValue("fallback");
    const { result, rerender } = renderController();

    act(() => result.current.setRecoveryUsername("@Alice "));
    await act(async () => result.current.recoverWithPasskey());
    auth.current = { ...auth.current, isAuthenticated: true, userName: "alice" };
    rerender();

    expect(show).not.toHaveBeenCalled();
  });

  it.each([
    { entry: "/login?redirectTo=/gardens/7", redirectTo: "/gardens/7" },
    { entry: "/login", redirectTo: "/home" },
    // Coming back from a sign-out never returns to the page the user just left.
    { entry: { pathname: "/login", state: { fromLogout: true } }, redirectTo: "/home" },
  ])("sends a finished login to $redirectTo", ({ entry, redirectTo }) => {
    const { result } = renderController(entry);

    expect(result.current.redirectTo).toBe(redirectTo);
  });
});
