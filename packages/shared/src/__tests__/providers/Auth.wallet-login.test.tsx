/**
 * @vitest-environment happy-dom
 */

import { renderHook, waitFor } from "@testing-library/react";
import { act, type ReactNode } from "react";
import type { Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActor, fromPromise } from "xstate";

import { createSmartAccountClientResolver } from "../../modules/auth/smartAccountClientResolver";
import {
  createMockP256Credential,
  createMockSmartAccountClient,
} from "../test-utils/mock-factories";
import { publishSignOut, SIGN_OUT_REVISION_KEY } from "../../modules/auth/sessionSignOut";
import { AUTH_MODE_STORAGE_KEY } from "../../modules/auth/session";
import { connectivityStore } from "../../stores/connectivity";
import { queryClient } from "../../config/react-query";
import { AuthProvider, useAuthContext } from "../../providers/Auth";
import { defaultPasskeyAdapters } from "../../workflows/auth-passkey-adapters";
import {
  authMachine,
  type PasskeyOperationInput,
  type PasskeySessionResult,
  type RestoreSessionInput,
  type RestoreSessionResult,
} from "../../workflows/authMachine";

const mocks = vi.hoisted(() => ({
  mockClearQueryClient: vi.fn(),
  mockClearServiceWorkerCaches: vi.fn(async () => undefined),
  mockCreateAuthActor: vi.fn(),
  mockCreateAuthServices: vi.fn(),
  mockDisconnect: vi.fn(async () => undefined),
  mockGetAppKit: vi.fn(),
  mockGetAuthActor: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockOpenAppKit: vi.fn(),
  mockReconnect: vi.fn(async () => []),
  mockTrackWalletRestore: vi.fn(),
  mockUseAccount: vi.fn(),
  mockUseConfig: vi.fn(() => ({ id: "wagmi-config" })),
}));

vi.mock("wagmi", () => ({
  useAccount: () => mocks.mockUseAccount(),
  useConfig: () => mocks.mockUseConfig(),
}));

vi.mock("@wagmi/core", () => ({
  disconnect: () => mocks.mockDisconnect(),
  reconnect: () => mocks.mockReconnect(),
}));

vi.mock("../../modules/app/authWalletRestoreAnalytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../modules/app/authWalletRestoreAnalytics")>()),
  trackAuthWalletRestore: (...args: unknown[]) => mocks.mockTrackWalletRestore(...args),
}));

vi.mock("../../config/appkit", () => ({
  getAppKit: () => mocks.mockGetAppKit(),
}));

vi.mock("../../config/react-query", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

vi.mock("../../modules/app/logger", () => ({
  logger: {
    debug: (...args: unknown[]) => mocks.mockLoggerDebug(...args),
    warn: (...args: unknown[]) => mocks.mockLoggerWarn(...args),
  },
}));

vi.mock("../../modules/app/service-worker", () => ({
  serviceWorkerManager: {
    clearAllCaches: () => mocks.mockClearServiceWorkerCaches(),
  },
}));

vi.mock("../../workflows/authActor", () => ({
  createAuthActor: (...args: unknown[]) => mocks.mockCreateAuthActor(...args),
  getAuthActor: () => mocks.mockGetAuthActor(),
}));

vi.mock("../../workflows/authServices", () => ({
  createAuthServices: (...args: unknown[]) => mocks.mockCreateAuthServices(...args),
}));

const TEST_WALLET = "0x0000000000000000000000000000000000000001" as Hex;
const EMBEDDED_WALLET = "0x0000000000000000000000000000000000000002" as Hex;
const OTHER_WALLET = "0x0000000000000000000000000000000000000003" as Hex;

type AccountState = {
  address?: Hex;
  isConnected: boolean;
  isConnecting: boolean;
  connector?: { id: string; name: string };
};

const disconnectedAccount: AccountState = {
  address: undefined,
  isConnected: false,
  isConnecting: false,
  connector: undefined,
};

const rabbyConnector = { id: "io.rabby", name: "Rabby" };
const embeddedConnector = { id: "ID_AUTH", name: "Google" };

let accountState: AccountState;
let actor: ReturnType<typeof createAuthTestActor>;

function createAuthTestActor(
  restoreAuthMode: "wallet" | "embedded" | null = null,
  restoreAddress: Hex | null = null,
  restore: () => Promise<RestoreSessionResult | null> = async () => null
) {
  return createActor(
    authMachine.provide({
      actors: {
        restoreSession: fromPromise<RestoreSessionResult | null, RestoreSessionInput>(restore),
        registerPasskey: fromPromise<PasskeySessionResult, PasskeyOperationInput>(async () => {
          throw new Error("registerPasskey should not run in wallet tests");
        }),
        authenticatePasskey: fromPromise<PasskeySessionResult, PasskeyOperationInput>(async () => {
          throw new Error("authenticatePasskey should not run in wallet tests");
        }),
      },
    }),
    {
      input: {
        chainId: 11155111,
        restoreAuthMode,
        restoreAddress,
      },
    }
  );
}

function setAccount(next: Partial<AccountState>) {
  accountState = { ...disconnectedAccount, ...next };
}

function renderAuth(adapters?: typeof defaultPasskeyAdapters) {
  function wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider adapters={adapters}>{children}</AuthProvider>;
  }

  return renderHook(() => useAuthContext(), { wrapper });
}

async function waitForReady() {
  await waitFor(() => {
    expect(actor.getSnapshot().matches("unauthenticated")).toBe(true);
  });
}

describe("AuthProvider wallet login bridge", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    setAccount(disconnectedAccount);
    mocks.mockUseAccount.mockImplementation(() => accountState);
    mocks.mockGetAppKit.mockReturnValue({
      open: mocks.mockOpenAppKit,
      // useWalletModalOpen() reads getState().open and subscribes for changes.
      getState: () => ({ open: false }),
      subscribeState: () => () => {},
    });

    actor = createAuthTestActor();
    actor.start();
    mocks.mockGetAuthActor.mockReturnValue(actor);
    mocks.mockCreateAuthActor.mockReturnValue(actor);
    mocks.mockCreateAuthServices.mockReturnValue({ source: "test-auth-services" });
  });

  it("signs out offline without waiting on wallet transport or erasing durable reads", async () => {
    const view = renderAuth();
    await waitForReady();
    act(() => {
      view.result.current.loginWithWallet();
    });
    setAccount({
      address: TEST_WALLET,
      isConnected: true,
      isConnecting: false,
      connector: rabbyConnector,
    });
    view.rerender();
    await waitFor(() => expect(view.result.current.isAuthenticated).toBe(true));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const gardens = ["greengoods", "gardens", 11155111];
    queryClient.setQueryData(gardens, [{ id: "garden" }]);
    queryClient.setQueryData(["wallet", "session"], "session-data");
    queryClient.setQueryData(["greengoods", "works", "online", "garden"], ["submitted"]);
    queryClient.setQueryData(["greengoods", "works", "merged", "garden"], ["private-draft"]);
    localStorage.setItem("__rq_pc__", "persisted-reads");
    const deleteDatabase = vi.spyOn(indexedDB, "deleteDatabase");
    // Offline, letting go of a WalletConnect session never finishes.
    mocks.mockDisconnect.mockReturnValueOnce(new Promise<undefined>(() => {}));
    await act(async () => {
      await view.result.current.signOut();
    });
    expect(view.result.current.isAuthenticated).toBe(false);
    expect(queryClient.getQueryData(gardens)).toEqual([{ id: "garden" }]);
    expect(queryClient.getQueryData(["wallet", "session"])).toBeUndefined();
    expect(queryClient.getQueryData(["greengoods", "works", "online", "garden"])).toEqual([
      "submitted",
    ]);
    expect(queryClient.getQueryData(["greengoods", "works", "merged", "garden"])).toBeUndefined();
    expect(localStorage.getItem("__rq_pc__")).toBe("persisted-reads");
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(mocks.mockClearServiceWorkerCaches).not.toHaveBeenCalled();
    // Sign-out started letting go of the wallet but did not wait for it.
    expect(mocks.mockDisconnect).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(view.result.current.walletAddress).toBeNull();
    expect(view.result.current.authMode).toBeNull();
    view.rerender();
    expect(view.result.current.isAuthenticated).toBe(false);
    // The wallet signed out of is never silently reused by the next wallet login.
    act(() => view.result.current.loginWithWallet());
    expect(view.result.current.isAuthenticated).toBe(false);
    fetchSpy.mockRestore();
    deleteDatabase.mockRestore();
    queryClient.clear();
  });

  it("composes injected passkey adapters into a provider-owned auth actor", () => {
    const view = renderAuth(defaultPasskeyAdapters);

    expect(mocks.mockCreateAuthServices).toHaveBeenCalledWith(defaultPasskeyAdapters);
    expect(mocks.mockCreateAuthActor).toHaveBeenCalledWith({ source: "test-auth-services" });
    expect(mocks.mockGetAuthActor).not.toHaveBeenCalled();

    view.unmount();
  });

  it("lets go of the wallet on sign-out so the next wallet login asks for a wallet", async () => {
    const view = renderAuth();
    await waitForReady();
    act(() => view.result.current.loginWithWallet());
    setAccount({ address: TEST_WALLET, isConnected: true, connector: rabbyConnector });
    view.rerender();
    await waitFor(() => expect(view.result.current.walletAddress).toBe(TEST_WALLET));
    expect(mocks.mockOpenAppKit).toHaveBeenCalledTimes(1);

    let finishDisconnect = () => {};
    mocks.mockDisconnect.mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        finishDisconnect = () => resolve(undefined);
      })
    );
    await act(async () => view.result.current.signOut());
    expect(view.result.current.isAuthenticated).toBe(false);
    expect(mocks.mockDisconnect).toHaveBeenCalledTimes(1);

    // Still letting go: the login waits rather than reusing the signed-out wallet.
    act(() => view.result.current.loginWithWallet());
    expect(view.result.current.isAuthenticated).toBe(false);
    expect(mocks.mockOpenAppKit).toHaveBeenCalledTimes(1);

    await act(async () => finishDisconnect());
    setAccount(disconnectedAccount);
    view.rerender();
    await waitFor(() => expect(mocks.mockOpenAppKit).toHaveBeenCalledTimes(2));
    expect(view.result.current.isAuthenticated).toBe(false);

    // The member can pick a different wallet, or the same one again.
    setAccount({ address: OTHER_WALLET, isConnected: true, connector: rabbyConnector });
    view.rerender();
    await waitFor(() => expect(view.result.current.walletAddress).toBe(OTHER_WALLET));
    expect(view.result.current.authMode).toBe("wallet");
  });

  it.each([
    ["wallet", rabbyConnector, TEST_WALLET],
    ["embedded", embeddedConnector, EMBEDDED_WALLET],
  ] as const)("clears a %s session when another tab signs out without echoing it", async (mode, connector, address) => {
    localStorage.setItem(AUTH_MODE_STORAGE_KEY, mode);
    setAccount({ address, isConnected: true, connector });
    const view = renderAuth();
    await waitFor(() => expect(view.result.current.isAuthenticated).toBe(true));
    localStorage.setItem("greengoods_credential", "recovery-credential");
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    localStorage.setItem("greengoods_signed_out", "true");
    localStorage.setItem("greengoods_sign_out_revision", "other-tab-logout");
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "greengoods_sign_out_revision",
          newValue: "other-tab-logout",
          storageArea: localStorage,
        })
      )
    );
    expect(view.result.current.isAuthenticated).toBe(false);
    expect(view.result.current.walletAddress).toBeNull();
    expect(view.result.current.embeddedAddress).toBeNull();
    expect(localStorage.getItem("greengoods_credential")).toBe("recovery-credential");
    expect(localStorage.getItem("greengoods_sign_out_revision")).toBe("other-tab-logout");
    view.rerender();
    expect(view.result.current.isAuthenticated).toBe(false);
    view.unmount();
  });

  it("revokes a restored passkey capability on another-tab logout while keeping its recovery metadata", async () => {
    const credential = createMockP256Credential() as unknown as PasskeySessionResult["credential"];
    const client =
      createMockSmartAccountClient() as unknown as PasskeySessionResult["smartAccountClient"];
    const resolver = createSmartAccountClientResolver({
      credential,
      primaryClient: client,
      primaryChainId: 11155111,
      expectedAddress: TEST_WALLET,
      buildSmartAccount: vi.fn(),
    });
    const session: PasskeySessionResult = {
      credential,
      smartAccountClient: client,
      smartAccountAddress: TEST_WALLET,
      resolveSmartAccountClient: resolver,
      userName: "gardener",
    };
    actor.stop();
    actor = createAuthTestActor(null, null, async () => session);
    mocks.mockGetAuthActor.mockReturnValue(actor);
    actor.start();
    localStorage.setItem("greengoods_credential", JSON.stringify(credential));
    const view = renderAuth();
    await waitFor(() => expect(view.result.current.authMode).toBe("passkey"));
    localStorage.setItem("greengoods_signed_out", "true");
    publishSignOut();
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SIGN_OUT_REVISION_KEY,
          storageArea: localStorage,
        })
      )
    );
    expect(view.result.current.isAuthenticated).toBe(false);
    expect(view.result.current.credential).toBeNull();
    expect(view.result.current.smartAccountAddress).toBeNull();
    expect(view.result.current.resolveSmartAccountClient).toBeNull();
    await expect(resolver(11155111)).rejects.toMatchObject({ code: "session_expired" });
    expect(localStorage.getItem("greengoods_credential")).toBe(JSON.stringify(credential));
    view.unmount();
    actor.stop();
  });

  it("cancels a wallet login waiting on disconnect when another tab signs out", async () => {
    const view = renderAuth();
    await waitForReady();
    act(() => view.result.current.loginWithWallet());
    setAccount({ address: TEST_WALLET, isConnected: true, connector: rabbyConnector });
    view.rerender();
    await waitFor(() => expect(view.result.current.isAuthenticated).toBe(true));
    let finishDisconnect = () => {};
    mocks.mockDisconnect.mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        finishDisconnect = () => resolve(undefined);
      })
    );
    await act(async () => view.result.current.signOut());
    act(() => view.result.current.loginWithWallet());
    const opens = mocks.mockOpenAppKit.mock.calls.length;
    publishSignOut();
    // The release may settle before the background tab receives its storage event.
    await act(async () => finishDisconnect());
    expect(mocks.mockOpenAppKit).toHaveBeenCalledTimes(opens);
    expect(view.result.current.isAuthenticated).toBe(false);
    view.unmount();
  });

  it.each([
    "loginWithPasskey",
    "createAccount",
  ] as const)("cancels %s before its disconnect finishes after another-tab logout", async (method) => {
    setAccount({ address: TEST_WALLET, isConnected: true, connector: rabbyConnector });
    const view = renderAuth();
    await waitForReady();
    let finishDisconnect = () => {};
    mocks.mockDisconnect.mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        finishDisconnect = () => resolve(undefined);
      })
    );
    let login: Promise<void>;
    act(() => {
      login = view.result.current[method]("gardener");
    });
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    localStorage.setItem("greengoods_signed_out", "true");
    // Delivery can be delayed; the pending action must check storage itself.
    publishSignOut();
    await act(async () => {
      finishDisconnect();
      await login;
    });
    expect(actor.getSnapshot().matches("unauthenticated")).toBe(true);
    expect(localStorage.getItem(AUTH_MODE_STORAGE_KEY)).toBeNull();
    expect(view.result.current.isAuthenticated).toBe(false);
    view.unmount();
  });

  it("goes ahead with only the latest login chosen while the wallet lets go", async () => {
    const view = renderAuth();
    await waitForReady();
    act(() => view.result.current.loginWithWallet());
    setAccount({ address: TEST_WALLET, isConnected: true, connector: rabbyConnector });
    view.rerender();
    await waitFor(() => expect(view.result.current.walletAddress).toBe(TEST_WALLET));

    let finishDisconnect = () => {};
    mocks.mockDisconnect.mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        finishDisconnect = () => resolve(undefined);
      })
    );
    await act(async () => view.result.current.signOut());
    act(() => view.result.current.loginWithWallet());
    act(() => view.result.current.loginWithEmbedded());
    const opensBefore = mocks.mockOpenAppKit.mock.calls.length;

    await act(async () => finishDisconnect());
    setAccount(disconnectedAccount);
    view.rerender();
    await waitFor(() => expect(mocks.mockOpenAppKit).toHaveBeenCalledTimes(opensBefore + 1));

    // The member's last choice, an embedded login, is the one that proceeds.
    setAccount({ address: EMBEDDED_WALLET, isConnected: true, connector: embeddedConnector });
    view.rerender();
    await waitFor(() => expect(view.result.current.authMode).toBe("embedded"));
    expect(localStorage.getItem(AUTH_MODE_STORAGE_KEY)).toBe("embedded");
    expect(mocks.mockOpenAppKit).toHaveBeenCalledTimes(opensBefore + 1);
  });

  it("drops a deferred wallet login when the member chooses a passkey instead", async () => {
    const view = renderAuth();
    await waitForReady();
    act(() => view.result.current.loginWithWallet());
    setAccount({ address: TEST_WALLET, isConnected: true, connector: rabbyConnector });
    view.rerender();
    await waitFor(() => expect(view.result.current.walletAddress).toBe(TEST_WALLET));

    let finishDisconnect = () => {};
    mocks.mockDisconnect.mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        finishDisconnect = () => resolve(undefined);
      })
    );
    await act(async () => view.result.current.signOut());
    act(() => view.result.current.loginWithWallet());
    await act(async () => view.result.current.loginWithPasskey("gardener"));
    const opensBefore = mocks.mockOpenAppKit.mock.calls.length;

    await act(async () => finishDisconnect());
    setAccount(disconnectedAccount);
    view.rerender();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(mocks.mockOpenAppKit).toHaveBeenCalledTimes(opensBefore);
    expect(localStorage.getItem(AUTH_MODE_STORAGE_KEY)).toBe("passkey");
  });

  it("keeps embedded logout local and requires explicit intent to use the connection again", async () => {
    const view = renderAuth();
    await waitForReady();
    setAccount({ address: EMBEDDED_WALLET, isConnected: true, connector: embeddedConnector });
    view.rerender();
    act(() => view.result.current.loginWithEmbedded());
    await waitFor(() => expect(view.result.current.authMode).toBe("embedded"));
    await act(async () => view.result.current.signOut());
    expect(view.result.current.isAuthenticated).toBe(false);
    view.rerender();
    expect(view.result.current.isAuthenticated).toBe(false);
    expect(mocks.mockDisconnect).not.toHaveBeenCalled();
    act(() => view.result.current.loginWithEmbedded());
    await waitFor(() => expect(view.result.current.authMode).toBe("embedded"));
    expect(view.result.current.embeddedAddress).toBe(EMBEDDED_WALLET);
  });

  it("authenticates a manual wallet login after the passive restore guard has already been spent", async () => {
    localStorage.setItem(AUTH_MODE_STORAGE_KEY, "embedded");
    const view = renderAuth();
    await waitForReady();

    setAccount({
      address: EMBEDDED_WALLET,
      isConnected: true,
      isConnecting: false,
      connector: embeddedConnector,
    });
    view.rerender();

    await waitFor(() => {
      expect(view.result.current.authMode).toBe("embedded");
    });

    act(() => {
      actor.send({ type: "SIGN_OUT" });
    });
    localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
    setAccount(disconnectedAccount);
    view.rerender();

    await waitFor(() => {
      expect(view.result.current.isAuthenticated).toBe(false);
    });

    act(() => {
      view.result.current.loginWithWallet();
    });

    expect(mocks.mockOpenAppKit).toHaveBeenCalledTimes(1);

    setAccount({
      address: TEST_WALLET,
      isConnected: true,
      isConnecting: false,
      connector: rabbyConnector,
    });
    view.rerender();

    await waitFor(() => {
      expect(view.result.current.authMode).toBe("wallet");
    });
    expect(view.result.current.walletAddress).toBe(TEST_WALLET);
  });

  it("authenticates immediately when a non-embedded wallet is already connected", async () => {
    setAccount({
      address: TEST_WALLET,
      isConnected: true,
      isConnecting: false,
      connector: rabbyConnector,
    });
    const view = renderAuth();
    await waitForReady();

    act(() => {
      view.result.current.loginWithWallet();
    });

    await waitFor(() => {
      expect(view.result.current.authMode).toBe("wallet");
    });
    expect(view.result.current.walletAddress).toBe(TEST_WALLET);
    expect(mocks.mockOpenAppKit).not.toHaveBeenCalled();
  });

  it("does not authenticate an AppKit embedded connector through wallet intent", async () => {
    const view = renderAuth();
    await waitForReady();

    act(() => {
      view.result.current.loginWithWallet();
    });

    setAccount({
      address: EMBEDDED_WALLET,
      isConnected: true,
      isConnecting: false,
      connector: embeddedConnector,
    });
    view.rerender();

    await waitFor(() => {
      expect(view.result.current.externalWalletConnected).toBe(true);
    });
    expect(view.result.current.isAuthenticated).toBe(false);
    expect(view.result.current.authMode).toBeNull();
  });

  it("keeps passive wallet restore working for page-load reconnects", async () => {
    localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
    setAccount({
      address: TEST_WALLET,
      isConnected: true,
      isConnecting: false,
      connector: rabbyConnector,
    });

    const view = renderAuth();

    await waitFor(() => {
      expect(view.result.current.authMode).toBe("wallet");
    });
    expect(view.result.current.walletAddress).toBe(TEST_WALLET);
    expect(mocks.mockTrackWalletRestore).toHaveBeenCalledWith({
      authMode: "wallet",
      outcome: "started",
    });
    expect(mocks.mockTrackWalletRestore).toHaveBeenCalledWith(
      expect.objectContaining({ authMode: "wallet", outcome: "success" })
    );
  });

  it("keeps a delayed wallet restore protected beyond two seconds", async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
      actor.stop();
      actor = createAuthTestActor("wallet");
      actor.start();
      mocks.mockGetAuthActor.mockReturnValue(actor);

      const view = renderAuth();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(actor.getSnapshot().matches({ restoring: "wallet" })).toBe(true);
      expect(view.result.current.isReady).toBe(false);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });

      expect(view.result.current.isReady).toBe(false);
      expect(mocks.mockTrackWalletRestore).toHaveBeenCalledWith(
        expect.objectContaining({ authMode: "wallet", outcome: "delayed" })
      );

      setAccount({
        address: TEST_WALLET,
        isConnected: true,
        isConnecting: false,
        connector: rabbyConnector,
      });
      view.rerender();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(view.result.current.isReady).toBe(true);
      expect(view.result.current.authMode).toBe("wallet");
      expect(mocks.mockTrackWalletRestore).toHaveBeenCalledWith(
        expect.objectContaining({ authMode: "wallet", outcome: "success" })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("ends a bounded restore with privacy-safe timeout telemetry", async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
      actor.stop();
      actor = createAuthTestActor("wallet");
      actor.start();
      mocks.mockGetAuthActor.mockReturnValue(actor);

      const view = renderAuth();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });

      // With no remembered address there is no identity to keep.
      expect(actor.getSnapshot().matches("unauthenticated")).toBe(true);
      expect(view.result.current.isReady).toBe(true);
      expect(mocks.mockTrackWalletRestore).toHaveBeenCalledWith(
        expect.objectContaining({
          authMode: "wallet",
          outcome: "failed",
          reason: "timeout",
          sessionKept: false,
        })
      );
      expect(JSON.stringify(mocks.mockTrackWalletRestore.mock.calls)).not.toContain(TEST_WALLET);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an offline restore readable and only spends the deadline once reconnected", async () => {
    vi.useFakeTimers();
    try {
      // The setup shim rebuilds the window listener map per test, so the
      // store's own listeners never see a dispatched event; drive it directly.
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      await connectivityStore.check();
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
      actor.stop();
      actor = createAuthTestActor("wallet", TEST_WALLET);
      actor.start();
      mocks.mockGetAuthActor.mockReturnValue(actor);

      const view = renderAuth();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      // Offline, the remembered wallet keeps the session mounted read-only and
      // the connector is never asked to reconnect.
      expect(actor.getSnapshot().matches({ restoring: "wallet" })).toBe(true);
      expect(view.result.current.isAuthenticated).toBe(true);
      expect(view.result.current.isReady).toBe(false);
      expect(mocks.mockTrackWalletRestore).not.toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "failed", reason: "timeout" })
      );
      expect(mocks.mockReconnect).not.toHaveBeenCalled();

      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      await act(async () => {
        window.dispatchEvent(new Event("online"));
        expect(mocks.mockReconnect).not.toHaveBeenCalled();
        await connectivityStore.check();
      });
      expect(mocks.mockReconnect).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      // The remembered wallet stays signed in once the window ends.
      expect(actor.getSnapshot().matches({ authenticated: "wallet" })).toBe(true);
      expect(view.result.current.isReady).toBe(true);
      expect(view.result.current.walletAddress).toBe(TEST_WALLET);
      expect(mocks.mockTrackWalletRestore).toHaveBeenCalledWith(
        expect.objectContaining({
          authMode: "wallet",
          outcome: "failed",
          reason: "timeout",
          sessionKept: true,
        })
      );

      // Kept, it asks the wallet again when the connection comes back, not on every check.
      const reconnects = mocks.mockReconnect.mock.calls.length;
      await act(async () => void (await connectivityStore.check()));
      expect(mocks.mockReconnect).toHaveBeenCalledTimes(reconnects);
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      await act(async () => void (await connectivityStore.check()));
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      await act(async () => void (await connectivityStore.check()));
      expect(mocks.mockReconnect).toHaveBeenCalledTimes(reconnects + 1);
    } finally {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      await connectivityStore.check();
      vi.useRealTimers();
    }
  });

  it("does not spend the restore deadline while the app is in the background", async () => {
    vi.useFakeTimers();
    try {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
      actor.stop();
      actor = createAuthTestActor("wallet");
      actor.start();
      mocks.mockGetAuthActor.mockReturnValue(actor);

      const view = renderAuth();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(actor.getSnapshot().matches({ restoring: "wallet" })).toBe(true);
      expect(view.result.current.isReady).toBe(false);
      expect(mocks.mockTrackWalletRestore).not.toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "failed", reason: "timeout" })
      );

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      act(() => document.dispatchEvent(new Event("visibilitychange")));

      expect(mocks.mockReconnect).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // PRD-1001: Take This Up on a phone sends the member to the wallet app, the
  // WalletConnect session drops there, and the wallet does not answer in time.
  it("keeps a wallet member signed in when the wallet drops while they sign in it", async () => {
    vi.useFakeTimers();
    const setVisibility = (value: "hidden" | "visible") => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value });
      act(() => document.dispatchEvent(new Event("visibilitychange")));
    };
    const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
    try {
      const view = renderAuth();
      await settle();
      act(() => view.result.current.loginWithWallet());
      setAccount({ address: TEST_WALLET, isConnected: true, connector: rabbyConnector });
      view.rerender();
      await settle();
      expect(view.result.current.authMode).toBe("wallet");

      setVisibility("hidden");
      setAccount(disconnectedAccount);
      view.rerender();
      await settle(4 * 60_000);
      setVisibility("visible");
      await settle(15_000);

      expect(view.result.current.isAuthenticated).toBe(true);
      expect(view.result.current.isReady).toBe(true);
      expect(view.result.current.authMode).toBe("wallet");
      expect(view.result.current.walletAddress).toBe(TEST_WALLET);
      expect(view.result.current.externalWalletConnected).toBe(false);
      expect(mocks.mockTrackWalletRestore).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "failed", reason: "timeout", sessionKept: true })
      );

      // Every return to the app asks the wallet again until it answers, even
      // when an earlier attempt never settles.
      const reconnects = mocks.mockReconnect.mock.calls.length;
      mocks.mockReconnect.mockReturnValueOnce(new Promise<never>(() => {}));
      setVisibility("hidden");
      setVisibility("visible");
      expect(mocks.mockReconnect).toHaveBeenCalledTimes(reconnects + 1);
      setVisibility("hidden");
      setVisibility("visible");
      expect(mocks.mockReconnect).toHaveBeenCalledTimes(reconnects + 2);

      setAccount({ address: TEST_WALLET, isConnected: true, connector: rabbyConnector });
      view.rerender();
      await settle();
      expect(view.result.current.externalWalletConnected).toBe(true);
      expect(view.result.current.walletAddress).toBe(TEST_WALLET);
      expect(mocks.mockTrackWalletRestore).toHaveBeenCalledWith({
        authMode: "wallet",
        outcome: "reconnected",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps asking the remembered wallet when only an embedded connector answers", async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
      actor.stop();
      actor = createAuthTestActor("wallet", TEST_WALLET);
      actor.start();
      mocks.mockGetAuthActor.mockReturnValue(actor);
      setAccount({ address: EMBEDDED_WALLET, isConnected: true, connector: embeddedConnector });

      const view = renderAuth();
      await act(async () => void (await vi.advanceTimersByTimeAsync(15_000)));
      expect(view.result.current.walletAddress).toBe(TEST_WALLET);
      expect(view.result.current.externalWalletConnected).toBe(true);

      const reconnects = mocks.mockReconnect.mock.calls.length;
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(mocks.mockReconnect).toHaveBeenCalledTimes(reconnects + 1);

      // Signing out leaves the unrelated embedded connection alone.
      await act(async () => view.result.current.signOut());
      expect(view.result.current.isAuthenticated).toBe(false);
      expect(mocks.mockDisconnect).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a restoring connector when the app comes back online", async () => {
    localStorage.setItem(AUTH_MODE_STORAGE_KEY, "wallet");
    actor.stop();
    actor = createAuthTestActor("wallet");
    actor.start();
    mocks.mockGetAuthActor.mockReturnValue(actor);

    const view = renderAuth();
    await waitFor(() => {
      expect(actor.getSnapshot().matches({ restoring: "wallet" })).toBe(true);
    });

    window.dispatchEvent(new Event("online"));

    expect(mocks.mockReconnect).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
