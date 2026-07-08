/**
 * @vitest-environment jsdom
 */

import { renderHook, waitFor } from "@testing-library/react";
import { act, type ReactNode } from "react";
import type { Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActor, fromPromise } from "xstate";

import { AUTH_MODE_STORAGE_KEY } from "../../modules/auth/session";
import { AuthProvider, useAuthContext } from "../../providers/Auth";
import { authMachine } from "../../workflows/authMachine";

const mocks = vi.hoisted(() => ({
  mockClearQueryClient: vi.fn(),
  mockClearServiceWorkerCaches: vi.fn(async () => undefined),
  mockDisconnect: vi.fn(async () => undefined),
  mockGetAppKit: vi.fn(),
  mockGetAuthActor: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockOpenAppKit: vi.fn(),
  mockUseAccount: vi.fn(),
  mockUseConfig: vi.fn(() => ({ id: "wagmi-config" })),
}));

vi.mock("wagmi", () => ({
  useAccount: () => mocks.mockUseAccount(),
  useConfig: () => mocks.mockUseConfig(),
}));

vi.mock("@wagmi/core", () => ({
  disconnect: (...args: unknown[]) => mocks.mockDisconnect(...args),
}));

vi.mock("../../config/appkit", () => ({
  getAppKit: () => mocks.mockGetAppKit(),
}));

vi.mock("../../config/react-query", () => ({
  queryClient: {
    clear: () => mocks.mockClearQueryClient(),
  },
}));

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
  getAuthActor: () => mocks.mockGetAuthActor(),
}));

const TEST_WALLET = "0x0000000000000000000000000000000000000001" as Hex;
const EMBEDDED_WALLET = "0x0000000000000000000000000000000000000002" as Hex;

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

function createAuthTestActor() {
  return createActor(
    authMachine.provide({
      actors: {
        restoreSession: fromPromise(async () => null),
        registerPasskey: fromPromise(async () => {
          throw new Error("registerPasskey should not run in wallet tests");
        }),
        authenticatePasskey: fromPromise(async () => {
          throw new Error("authenticatePasskey should not run in wallet tests");
        }),
      },
    }),
    {
      input: {
        chainId: 11155111,
      },
    }
  );
}

function setAccount(next: Partial<AccountState>) {
  accountState = { ...disconnectedAccount, ...next };
}

function renderAuth() {
  function wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
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
  });
});
