/** @vitest-environment happy-dom */
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminLoginController } from "../../../hooks/admin-ui/auth/useAdminLoginController";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  create: vi.fn(),
  auth: vi.fn(),
  serverEnabled: vi.fn(),
  context: vi.fn(),
  trackError: vi.fn(),
}));
vi.mock("../../../providers/Auth", () => ({
  useAuthActions: () => ({ loginWithPasskey: mocks.login, createAccount: mocks.create }),
  useAuthState: () => mocks.auth(),
}));
vi.mock("../../../config/passkeyServer", async (original) => ({
  ...(await original<typeof import("../../../config/passkeyServer")>()),
  isPasskeyServerEnabled: () => mocks.serverEnabled(),
  classifyPasskeyCeremonyContext: () => mocks.context(),
}));
vi.mock("../../../modules/auth/session", () => ({ getStoredUsername: () => "qa-steward" }));
vi.mock("../../../modules/app/error-categories", () => ({ trackAuthError: mocks.trackError }));

describe("useAdminLoginController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.login.mockResolvedValue(undefined);
    mocks.create.mockResolvedValue(undefined);
    mocks.auth.mockReturnValue({ hasStoredCredential: false, isAuthenticating: false });
    mocks.serverEnabled.mockReturnValue(true);
    mocks.context.mockReturnValue({ supported: true });
  });

  it("starts at the entry, or at the name step the boot screen asked for", () => {
    expect(renderHookWithProviders(() => useAdminLoginController()).result.current.mode).toBe(
      "entry"
    );
    const { result } = renderHookWithProviders(() =>
      useAdminLoginController({ initialMode: "username" })
    );
    expect(result.current.mode).toBe("username");
  });

  it("signs in by the normalized name and creates the account when none has it", async () => {
    const { result } = renderHookWithProviders(() => useAdminLoginController());
    act(() => result.current.changeMode("username"));
    act(() => result.current.setUsername(" @QA-STEW ARD "));
    await act(() => result.current.continueByName());
    expect(mocks.login).toHaveBeenCalledWith("qa-stew ard", { createIfMissing: true });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(result.current.isSigningIn).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("creates from the name step when names cannot be looked up, and clears a failure on Back", async () => {
    mocks.serverEnabled.mockReturnValue(false);
    const { result, rerender } = renderHookWithProviders(() => useAdminLoginController());
    act(() => result.current.setUsername(" @NEW-STEWARD "));
    await act(() => result.current.continueByName());
    expect(mocks.create).toHaveBeenCalledWith("new-steward");
    expect(mocks.login).not.toHaveBeenCalled();
    mocks.auth.mockReturnValue({ hasStoredCredential: false, isAuthenticating: true });
    rerender();
    mocks.auth.mockReturnValue({
      hasStoredCredential: false,
      isAuthenticating: false,
      error: new Error(
        "That recovery name is already registered. Try recovery or choose another name."
      ),
    });
    rerender();
    expect(result.current.error).toBe("That name is already registered.");
    act(() => result.current.changeMode("entry"));
    expect(result.current.error).toBeNull();
    expect(result.current.username).toBe(" @NEW-STEWARD ");
  });

  it("rejects a short normalized name before asking for a passkey", async () => {
    const { result } = renderHookWithProviders(() => useAdminLoginController());
    act(() => result.current.setUsername(" @AB "));
    await act(() => result.current.continueByName());
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Display name must be at least 3 characters.");
  });

  it.each([
    ["timeout", "Your wallet app didn't open. Try again, or sign in with a passkey."],
    ["connect_error", "We couldn't connect your wallet. Try again, or sign in with a passkey."],
  ] as const)("points a %s wallet attempt to a passkey once auth settles", (failure, expected) => {
    mocks.auth.mockReturnValue({
      hasStoredCredential: false,
      isAuthenticating: true,
      walletConnectFailure: failure,
    });
    const { result, rerender } = renderHookWithProviders(() => useAdminLoginController());
    expect(result.current.error).toBeNull();
    // A wallet sign-in holds the screen without showing a passkey's progress.
    expect(result.current.isSigningIn).toBe(true);
    expect(result.current.isPasskeySigningIn).toBe(false);
    mocks.auth.mockReturnValue({
      hasStoredCredential: false,
      isAuthenticating: false,
      walletConnectFailure: failure,
    });
    rerender();
    expect(result.current.error).toBe(expected);
    // Trying the wallet again clears what the last attempt said.
    act(() => result.current.beginWalletSignIn());
    rerender();
    expect(result.current.error).toBeNull();
  });

  it("says a stalled wallet request needs a reload", () => {
    mocks.auth.mockReturnValue({
      hasStoredCredential: false,
      isAuthenticating: false,
      walletReleaseStalled: true,
    });
    const { result } = renderHookWithProviders(() => useAdminLoginController());
    expect(result.current.error).toBe(
      "The previous wallet request has not ended. Reload to retry, or sign in with a passkey."
    );
  });

  it("keeps unnamed remembered sign-in when server-backed names are disabled", async () => {
    mocks.serverEnabled.mockReturnValue(false);
    mocks.auth.mockReturnValue({ hasStoredCredential: true, isAuthenticating: false });
    const { result } = renderHookWithProviders(() => useAdminLoginController());
    act(() => result.current.setUsername("another-account"));
    expect(result.current.canSignInByName).toBe(false);
    expect(result.current.storedUsername).toBe("qa-steward");
    await act(() => result.current.signInWithStoredPasskey());
    expect(mocks.login).toHaveBeenCalledWith(undefined);
  });

  it("holds one sign-in until it settles and prevents duplicate requests", async () => {
    let finish!: () => void;
    mocks.login.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    const { result } = renderHookWithProviders(() => useAdminLoginController());
    await act(async () => {
      void result.current.signInWithStoredPasskey();
    });
    expect(result.current.isSigningIn).toBe(true);
    expect(result.current.isPasskeySigningIn).toBe(true);
    await act(async () => {
      void result.current.signInWithStoredPasskey();
    });
    expect(mocks.login).toHaveBeenCalledOnce();
    await act(async () => {
      finish();
    });
    expect(result.current.isSigningIn).toBe(false);
  });

  it("does not start a second auth flow while Shared auth is busy", async () => {
    mocks.auth.mockReturnValue({ hasStoredCredential: true, isAuthenticating: true });
    const { result } = renderHookWithProviders(() => useAdminLoginController());
    await act(() => result.current.signInWithStoredPasskey());
    expect(result.current.isSigningIn).toBe(true);
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("shows cancellation as cancellation, without recording an auth failure", async () => {
    mocks.login.mockRejectedValueOnce(new Error("Passkey authentication was cancelled"));
    const { result } = renderHookWithProviders(() => useAdminLoginController());
    await act(() => result.current.signInWithStoredPasskey());
    expect(result.current.error).toBe("Sign in was canceled.");
    expect(result.current.isSigningIn).toBe(false);
    expect(mocks.trackError).not.toHaveBeenCalled();

    // A create cancelled in the ceremony, whose result arrives through auth state, says no
    // account was made.
    mocks.serverEnabled.mockReturnValue(false);
    const created = renderHookWithProviders(() => useAdminLoginController());
    act(() => created.result.current.setUsername("new-steward"));
    await act(() => created.result.current.continueByName());
    mocks.auth.mockReturnValue({ hasStoredCredential: false, isAuthenticating: true });
    created.rerender();
    mocks.auth.mockReturnValue({
      hasStoredCredential: false,
      isAuthenticating: false,
      error: new Error("Passkey authentication was cancelled"),
    });
    created.rerender();
    expect(created.result.current.error).toBe("No account was created. Try again.");
  });

  it("keeps the name and a clear transport error, then recovers on retry", async () => {
    const unavailable = new Error("HTTP request failed");
    unavailable.name = "HttpRequestError";
    mocks.login.mockRejectedValueOnce(unavailable);
    const { result } = renderHookWithProviders(() => useAdminLoginController());
    act(() => result.current.setUsername("qa-steward"));
    await act(() => result.current.continueByName());
    expect(result.current.error).toBe("Passkey recovery is temporarily unavailable.");
    expect(result.current.username).toBe("qa-steward");
    expect(mocks.trackError).toHaveBeenCalledWith(
      unavailable,
      expect.objectContaining({
        metadata: { has_stored_credential: false },
      })
    );
    await act(() => result.current.continueByName());
    expect(result.current.error).toBeNull();
    expect(mocks.login).toHaveBeenCalledTimes(2);
  });

  it("refuses an unsupported ceremony context before calling Shared auth", async () => {
    mocks.context.mockReturnValue({ supported: false });
    const { result } = renderHookWithProviders(() => useAdminLoginController());
    await act(() => result.current.signInWithStoredPasskey());
    expect(result.current.error).toBe("Open Green Goods in the recommended browser.");
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it.each([
    ["Passkey recovery is unavailable right now", "Passkey recovery is temporarily unavailable."],
    ["Passkey authentication was cancelled", "Sign in was canceled."],
    ["Passkey address mismatch", "That passkey is for a different account."],
    ["No passkey found", "No passkey found for that username."],
  ])("shows the actor's asynchronous failure: %s", async (message, expected) => {
    const { result, rerender } = renderHookWithProviders(() => useAdminLoginController());
    act(() => result.current.setUsername("qa-steward"));
    await act(() => result.current.continueByName());
    mocks.auth.mockReturnValue({
      hasStoredCredential: false,
      isAuthenticating: true,
      error: new Error(message),
    });
    rerender();
    expect(result.current.error).toBeNull();
    mocks.auth.mockReturnValue({
      hasStoredCredential: false,
      isAuthenticating: false,
      error: new Error(message),
    });
    rerender();
    expect(result.current.error).toBe(expected);
    expect(result.current.username).toBe("qa-steward");
    expect(result.current.isSigningIn).toBe(false);
  });
});

it("ignores stale actor failures on mount and while starting a new ceremony", async () => {
  mocks.context.mockReturnValue({ supported: true });
  mocks.login.mockResolvedValue(undefined);
  const oldError = new Error("Passkey authentication was cancelled");
  mocks.auth.mockReturnValue({
    hasStoredCredential: false,
    isAuthenticating: false,
    error: oldError,
  });
  const { result, rerender } = renderHookWithProviders(() => useAdminLoginController());
  expect(result.current.error).toBeNull();
  act(() => result.current.setUsername("qa-steward"));
  await act(() => result.current.continueByName());
  rerender();
  expect(result.current.error).toBeNull();
  mocks.auth.mockReturnValue({ hasStoredCredential: false, isAuthenticating: true, error: null });
  rerender();
  mocks.auth.mockReturnValue({
    hasStoredCredential: false,
    isAuthenticating: false,
    error: new Error("No passkey found"),
  });
  rerender();
  expect(result.current.error).toBe("No passkey found for that username.");
});
