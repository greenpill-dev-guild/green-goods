/**
 * useWalletNetworkAlignment Tests
 * @vitest-environment happy-dom
 *
 * A phone wallet that switches without a prompt is moved when its connection
 * comes up. No other wallet is asked anything, and nothing is shown: each act
 * switches the wallet to the network it needs.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ARBITRUM = 42161;
const CELO = 42220;

const mocks = vi.hoisted(() => ({
  // wagmi's config is one stable object for the life of the app.
  config: { wagmi: true },
  authMode: "wallet" as "wallet" | "passkey",
  account: { status: "connected", chainId: 42161 as number } as {
    status: string;
    chainId: number;
    address?: string;
    connector?: { uid: string };
  },
  /** The connection wagmi holds now, when a test moves it ahead of what was rendered. */
  live: undefined as undefined | { address?: string; connector?: { uid: string } },
  walletNetworkOtherThan: vi.fn(),
  walletSwitchesQuietly: vi.fn(),
  ensureWagmiWalletChain: vi.fn(),
  /** The wallet was asked to move: the guard's last check let the switch through. */
  switched: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@wagmi/core", () => ({
  getAccount: () => mocks.live ?? mocks.account,
}));

vi.mock("wagmi", () => ({
  useConfig: () => mocks.config,
  useAccount: () => mocks.account,
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ authMode: mocks.authMode }),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { warn: mocks.warn },
}));

vi.mock("../../../modules/transactions/chain-guard", () => ({
  walletNetworkOtherThan: (...args: unknown[]) => mocks.walletNetworkOtherThan(...args),
  walletSwitchesQuietly: (...args: unknown[]) => mocks.walletSwitchesQuietly(...args),
  ensureWagmiWalletChain: (...args: unknown[]) => mocks.ensureWagmiWalletChain(...args),
}));

import { useWalletNetworkAlignment } from "../../../hooks/blockchain/useWalletNetworkAlignment";

/** A browser wallet, which would prompt, holding the connection. */
const BROWSER_WALLET = {
  address: "0x2222222222222222222222222222222222222222",
  connector: { uid: "browser-wallet" },
};

/** Puts the wallet on a network; `undefined` is the app's own. */
const walletOn = (chainId: number | undefined) =>
  mocks.walletNetworkOtherThan.mockResolvedValue(chainId);

describe("useWalletNetworkAlignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authMode = "wallet";
    mocks.account = { status: "connected", chainId: ARBITRUM };
    mocks.live = undefined;
    mocks.walletSwitchesQuietly.mockResolvedValue(true);
    // As the guard does for a wallet on another network: it asks who the switch
    // is for, then switches.
    mocks.ensureWagmiWalletChain.mockImplementation(
      async (_config, _chainId, _reason, beforeSwitch?: () => void | Promise<void>) => {
        await beforeSwitch?.();
        mocks.switched();
      }
    );
  });

  it("moves a phone wallet that switches without a prompt when it connects", async () => {
    walletOn(CELO);
    renderHook(() => useWalletNetworkAlignment());

    await waitFor(() =>
      expect(mocks.ensureWagmiWalletChain).toHaveBeenCalledExactlyOnceWith(
        mocks.config,
        ARBITRUM,
        "sign-in",
        expect.any(Function)
      )
    );
    expect(mocks.switched).toHaveBeenCalledOnce();
  });

  it("asks nothing of a wallet that would show a prompt, or one already on the network", async () => {
    // A browser wallet left on Celo: its next act asks, nothing asks before it.
    walletOn(CELO);
    mocks.walletSwitchesQuietly.mockResolvedValue(false);
    const browser = renderHook(() => useWalletNetworkAlignment());
    await waitFor(() => expect(mocks.walletSwitchesQuietly).toHaveBeenCalled());
    browser.unmount();

    walletOn(undefined);
    mocks.walletSwitchesQuietly.mockClear();
    renderHook(() => useWalletNetworkAlignment());
    await waitFor(() => expect(mocks.walletNetworkOtherThan).toHaveBeenCalledTimes(2));

    expect(mocks.walletSwitchesQuietly).not.toHaveBeenCalled();
    expect(mocks.ensureWagmiWalletChain).not.toHaveBeenCalled();
  });

  it("leaves the wallet alone while the member is not signed in with it", async () => {
    walletOn(CELO);
    mocks.authMode = "passkey";
    const passkey = renderHook(() => useWalletNetworkAlignment());
    passkey.unmount();

    mocks.authMode = "wallet";
    mocks.account = { status: "reconnecting", chainId: ARBITRUM };
    renderHook(() => useWalletNetworkAlignment());
    await Promise.resolve();

    expect(mocks.walletNetworkOtherThan).not.toHaveBeenCalled();
    expect(mocks.ensureWagmiWalletChain).not.toHaveBeenCalled();
  });

  it("moves the next wallet too when another one takes the connection over", async () => {
    walletOn(undefined);
    const { rerender } = renderHook(() => useWalletNetworkAlignment());
    await waitFor(() => expect(mocks.walletNetworkOtherThan).toHaveBeenCalledOnce());

    // wagmi stays connected, and its stored network still reads as the app's.
    walletOn(CELO);
    mocks.account = {
      status: "connected",
      chainId: ARBITRUM,
      address: "0x2222222222222222222222222222222222222222",
      connector: { uid: "another-wallet" },
    };
    rerender();

    await waitFor(() => expect(mocks.ensureWagmiWalletChain).toHaveBeenCalledOnce());
  });

  // Regression: a run for one wallet went on to switch after another wallet had
  // taken the connection over, so a browser wallet could be prompted at sign-in.
  // React cleans the effect up a moment after wagmi's connection changes, so
  // both orders count.
  it.each([
    {
      name: "after React has re-rendered",
      takeOver: (rerender: () => void) => {
        mocks.account = { status: "connected", chainId: ARBITRUM, ...BROWSER_WALLET };
        rerender();
      },
    },
    {
      name: "before React has re-rendered",
      takeOver: () => {
        mocks.live = BROWSER_WALLET;
      },
    },
  ])("drops its move when another wallet takes the connection over $name", async ({ takeOver }) => {
    walletOn(CELO);
    let answerFirst: (quiet: boolean) => void = () => undefined;
    mocks.walletSwitchesQuietly
      .mockReturnValueOnce(
        new Promise<boolean>((resolve) => {
          answerFirst = resolve;
        })
      )
      .mockResolvedValue(false);
    const { rerender } = renderHook(() => useWalletNetworkAlignment());
    await waitFor(() => expect(mocks.walletSwitchesQuietly).toHaveBeenCalledOnce());

    takeOver(rerender);
    answerFirst(true);
    await waitFor(() => expect(mocks.ensureWagmiWalletChain).toHaveBeenCalledOnce());

    expect(mocks.switched).not.toHaveBeenCalled();
    expect(mocks.warn).not.toHaveBeenCalled();
  });

  // A session can drop or reorder its accounts while the wallet is being read.
  it("leaves a wallet alone when its switch stops being quiet by the time the guard asks", async () => {
    walletOn(CELO);
    mocks.walletSwitchesQuietly.mockResolvedValueOnce(true).mockResolvedValue(false);
    renderHook(() => useWalletNetworkAlignment());

    await waitFor(() => expect(mocks.ensureWagmiWalletChain).toHaveBeenCalledOnce());
    await mocks.ensureWagmiWalletChain.mock.results[0]?.value.catch(() => undefined);

    expect(mocks.switched).not.toHaveBeenCalled();
  });

  it("keeps a failed move to itself: the next act switches, or says why it cannot", async () => {
    walletOn(CELO);
    mocks.ensureWagmiWalletChain.mockRejectedValue(new Error("Network switch rejected"));
    renderHook(() => useWalletNetworkAlignment());

    await waitFor(() =>
      expect(mocks.warn).toHaveBeenCalledWith(
        expect.stringContaining("did not move"),
        expect.objectContaining({ error: "Network switch rejected" })
      )
    );
  });
});
