/**
 * useWalletNetworkNotice Tests
 * @vitest-environment happy-dom
 *
 * A phone wallet that switches without a prompt is moved when its connection
 * comes up and never shown a notice. Any other wallet gets the notice, at
 * sign-in or on return to the app, and nothing is switched on return.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIntlWrapper } from "../../test-utils/render-helpers";

const ARBITRUM = 42161;
const CELO = 42220;

const mocks = vi.hoisted(() => ({
  // wagmi's config is one stable object for the life of the app.
  config: { wagmi: true },
  account: { status: "connected", chainId: 42161 as number } as {
    status: string;
    chainId: number;
    address?: string;
    connector?: { uid: string };
  },
  walletNetworkOtherThan: vi.fn(),
  walletSwitchesQuietly: vi.fn(),
  ensureWagmiWalletChain: vi.fn(),
  guardSwitched: (() => undefined) as () => void,
}));

vi.mock("wagmi", () => ({
  useConfig: () => mocks.config,
  useAccount: () => mocks.account,
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ authMode: "wallet" }),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

vi.mock("../../../modules/transactions/chain-guard", () => ({
  walletNetworkOtherThan: (...args: unknown[]) => mocks.walletNetworkOtherThan(...args),
  walletSwitchesQuietly: (...args: unknown[]) => mocks.walletSwitchesQuietly(...args),
  ensureWagmiWalletChain: (...args: unknown[]) => mocks.ensureWagmiWalletChain(...args),
  onWalletNetworkSwitched: (listener: () => void) => {
    mocks.guardSwitched = listener;
    return () => undefined;
  },
}));

import { useWalletNetworkNotice } from "../../../hooks/blockchain/useWalletNetworkNotice";

const renderNotice = () =>
  renderHook(() => useWalletNetworkNotice(), { wrapper: createIntlWrapper() });

/** Puts the wallet on a network; `undefined` is the app's own. */
const walletOn = (chainId: number | undefined) =>
  mocks.walletNetworkOtherThan.mockResolvedValue(chainId);

describe("useWalletNetworkNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.account = { status: "connected", chainId: ARBITRUM };
    mocks.walletSwitchesQuietly.mockResolvedValue(false);
    // A switch that lands moves the wallet.
    mocks.ensureWagmiWalletChain.mockImplementation(async () => {
      walletOn(undefined);
    });
  });

  it("names a browser wallet's other network at sign-in, and clears once Switch lands", async () => {
    walletOn(CELO);
    const { result } = renderNotice();
    await waitFor(() => expect(result.current?.message).toBe("Wallet on Celo"));
    expect(result.current?.switchLabel).toBe("Switch to Arbitrum One");
    // A browser wallet is never switched without the tap.
    expect(mocks.ensureWagmiWalletChain).not.toHaveBeenCalled();

    await act(() => result.current!.switchNetwork());

    expect(mocks.ensureWagmiWalletChain).toHaveBeenCalledWith(mocks.config, ARBITRUM, "notice");
    expect(result.current).toBeNull();
  });

  it("moves a phone wallet that switches without a prompt when it connects, and shows it nothing", async () => {
    walletOn(CELO);
    mocks.walletSwitchesQuietly.mockResolvedValue(true);
    const { result } = renderNotice();

    await waitFor(() =>
      expect(mocks.ensureWagmiWalletChain).toHaveBeenCalledWith(mocks.config, ARBITRUM, "sign-in")
    );
    expect(result.current).toBeNull();
  });

  it("switches nothing when that phone wallet comes back to the app on another network", async () => {
    // Coming back is when a send approved in the wallet is still in flight.
    walletOn(undefined);
    mocks.walletSwitchesQuietly.mockResolvedValue(true);
    const { result } = renderNotice();
    await waitFor(() => expect(mocks.walletNetworkOtherThan).toHaveBeenCalled());

    walletOn(CELO);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(mocks.walletSwitchesQuietly).toHaveBeenCalled());

    expect(mocks.ensureWagmiWalletChain).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it("says the switch did not take when the wallet refuses, until the wallet is somewhere else", async () => {
    walletOn(CELO);
    mocks.ensureWagmiWalletChain.mockRejectedValueOnce(new Error("Network switch rejected"));
    const { result, rerender } = renderNotice();
    await waitFor(() => expect(result.current?.message).toBe("Wallet on Celo"));

    await act(() => result.current!.switchNetwork());
    expect(result.current?.message).toBe("Wallet still on Celo");

    // Moved by hand to a network the app does not list: the refusal never named it.
    walletOn(8453);
    mocks.account = { status: "connected", chainId: 8453 };
    rerender();
    await waitFor(() => expect(result.current?.message).toBe("Wallet on another network"));
  });

  it("raises the notice on return to the app, not when the wallet moves during use", async () => {
    walletOn(undefined);
    const { result, rerender } = renderNotice();
    await waitFor(() => expect(mocks.walletNetworkOtherThan).toHaveBeenCalled());

    // A G$ send moves the wallet to Celo while the member is in the app.
    walletOn(CELO);
    mocks.account = { status: "connected", chainId: CELO };
    rerender();
    await act(async () => {});
    expect(result.current).toBeNull();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(result.current?.message).toBe("Wallet on Celo"));
  });

  it("checks again when another wallet takes over the connection", async () => {
    walletOn(undefined);
    const { result, rerender } = renderNotice();
    await waitFor(() => expect(mocks.walletNetworkOtherThan).toHaveBeenCalled());
    expect(result.current).toBeNull();

    // wagmi stays connected, and its stored network still reads as the app's.
    walletOn(CELO);
    mocks.account = {
      status: "connected",
      chainId: ARBITRUM,
      address: "0x2222222222222222222222222222222222222222",
      connector: { uid: "another-wallet" },
    };
    rerender();

    await waitFor(() => expect(result.current?.message).toBe("Wallet on Celo"));
  });

  it("clears once an act's own network check has moved the wallet, and forgets an earlier refusal with it", async () => {
    walletOn(CELO);
    mocks.ensureWagmiWalletChain.mockRejectedValueOnce(new Error("Network switch rejected"));
    const { result } = renderNotice();
    await waitFor(() => expect(result.current?.message).toBe("Wallet on Celo"));
    await act(() => result.current!.switchNetwork());
    expect(result.current?.message).toBe("Wallet still on Celo");

    // wagmi's stored network never changes here; only the guard says it switched.
    walletOn(undefined);
    act(() => mocks.guardSwitched());
    await waitFor(() => expect(result.current).toBeNull());

    // Back on Celo later, nothing was refused this time.
    walletOn(CELO);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(result.current?.message).toBe("Wallet on Celo"));
  });
});
