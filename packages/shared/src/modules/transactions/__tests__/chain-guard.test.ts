import {
  ConnectorAccountNotFoundError,
  ConnectorChainMismatchError,
  ConnectorNotConnectedError,
  getWalletClient,
  type Config,
} from "@wagmi/core";
import { BaseError, ChainMismatchError, SwitchChainError, UserRejectedRequestError } from "viem";
import { arbitrum } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appKit: null as unknown,
  trackSwitch: vi.fn(),
}));
vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: vi.fn(),
  peekAppKit: () => mocks.appKit,
}));
vi.mock("../../app/walletNetworkSwitchAnalytics", () => ({
  trackWalletNetworkSwitch: mocks.trackSwitch,
}));

import { getWagmiConfig } from "../../../config/appkit";
import { refusedForWalletNetwork } from "../../../utils/errors/wallet-network-refusal";
import {
  ensureWagmiWalletChain,
  readyWalletClient,
  retryOnWalletChainMismatch,
  walletSwitchesQuietly,
} from "../chain-guard";

const ARBITRUM = 42161;
const CELO = 42220;
const BASE = 8453;

/**
 * A connected wallet as wagmi holds it. `stored` is the network wagmi kept for
 * the connection, `connector` what the connector reports, and `provider` what
 * the wallet answers to `eth_chainId`. On 2026-10-01 a phone wallet had
 * Arbitrum stored while its connector and provider said Celo.
 */
function wallet({
  stored = ARBITRUM,
  connector: connectorChain = CELO as number | string,
  provider: providerChain = Number(connectorChain),
  type = "walletConnect",
  session = undefined as
    | { namespaces: Record<string, { accounts?: string[]; chains?: string[] }> }
    | undefined,
} = {}) {
  const on = { connector: connectorChain, provider: providerChain };
  const provider = {
    session,
    request: vi.fn(async () => `0x${on.provider.toString(16)}`),
  };
  const connector = {
    uid: "wallet",
    id: type,
    type,
    name: type,
    getChainId: vi.fn(async () => on.connector),
    getProvider: vi.fn(async () => provider),
    switchChain: vi.fn(async ({ chainId }: { chainId: number }) => {
      on.connector = chainId;
      on.provider = chainId;
      return { id: chainId };
    }),
  };
  const config = {
    chains: [{ id: ARBITRUM }, { id: CELO }],
    state: {
      current: "wallet",
      status: "connected",
      connections: new Map([
        [
          "wallet",
          {
            accounts: ["0x1111111111111111111111111111111111111111"],
            chainId: stored,
            connector,
          },
        ],
      ]),
    },
  } as unknown as Config;
  return { config, connector, on };
}

/** AppKit as the guard uses it; `switchNetwork` stands in for what AppKit does on a switch. */
function appKitThat(switchNetwork: (network: { id: number }) => Promise<void>) {
  const appKit = {
    getCaipNetworks: () => [{ id: ARBITRUM }, { id: CELO }],
    switchNetwork: vi.fn(switchNetwork),
  };
  mocks.appKit = appKit;
  return appKit;
}

beforeEach(() => {
  mocks.appKit = null;
  mocks.trackSwitch.mockClear();
});

describe("ensureWagmiWalletChain", () => {
  it("switches when the wallet is on another network, even though wagmi's stored one matches", async () => {
    const { config, connector, on } = wallet({ stored: ARBITRUM, connector: CELO });

    await ensureWagmiWalletChain(config, ARBITRUM);

    expect(connector.switchChain).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: ARBITRUM })
    );
    expect(on).toEqual({ connector: ARBITRUM, provider: ARBITRUM });
  });

  it("switches through AppKit when AppKit owns the connection, so its selected network moves too", async () => {
    const { config, connector, on } = wallet();
    const appKit = appKitThat(async (network) => {
      on.connector = network.id;
      on.provider = network.id;
    });

    await ensureWagmiWalletChain(config, ARBITRUM);

    expect(appKit.switchNetwork).toHaveBeenCalledWith({ id: ARBITRUM }, { throwOnFailure: true });
    expect(connector.switchChain).not.toHaveBeenCalled();
  });

  it("asks the wallet through wagmi when AppKit moved only its own selection", async () => {
    // AppKit skips the wallet when it holds no account for it, and its
    // WalletConnect connector then reports the selection AppKit just set.
    const { config, connector, on } = wallet();
    appKitThat(async (network) => {
      on.connector = network.id;
    });

    await ensureWagmiWalletChain(config, ARBITRUM);

    expect(connector.switchChain).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: ARBITRUM })
    );
    expect(on.provider).toBe(ARBITRUM);
    expect(mocks.trackSwitch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ outcome: "switched", via: "wagmi" })
    );
  });

  it("refuses to continue when the wallet still reports the old network after switching", async () => {
    const { config, connector } = wallet();
    connector.switchChain.mockResolvedValueOnce({ id: ARBITRUM });

    await expect(ensureWagmiWalletChain(config, ARBITRUM)).rejects.toMatchObject({
      name: "WalletChainMismatchError",
      outcome: "unconfirmed",
      targetChainId: ARBITRUM,
      walletChainId: CELO,
    });
  });

  it("leaves a wallet alone when it is on the network, and a disconnected one untouched", async () => {
    const onArbitrum = wallet({ stored: CELO, connector: ARBITRUM });
    await ensureWagmiWalletChain(onArbitrum.config, ARBITRUM);
    expect(onArbitrum.connector.switchChain).not.toHaveBeenCalled();

    const gone = wallet();
    (gone.config.state as { status: string }).status = "disconnected";
    (gone.config.state as { current: string | null }).current = null;
    await ensureWagmiWalletChain(gone.config, ARBITRUM);
    expect(gone.connector.getChainId).not.toHaveBeenCalled();
  });

  it("reads a switch declined through AppKit as the person's rejection, and reports it without identity", async () => {
    // AppKit rethrows every failure as its own error, with the wallet's inside.
    const declined = new UserRejectedRequestError(new Error("User rejected the request."));
    const { config } = wallet({ type: "injected" });
    appKitThat(async () => {
      throw Object.assign(new Error("User rejected the request."), {
        name: "AppKitError",
        originalError: declined,
      });
    });

    await expect(ensureWagmiWalletChain(config, ARBITRUM)).rejects.toMatchObject({
      message: expect.stringContaining("Network switch rejected"),
      outcome: "rejected",
      cause: declined,
    });
    expect(mocks.trackSwitch).toHaveBeenCalledExactlyOnceWith({
      reason: "write",
      outcome: "rejected",
      fromChainId: CELO,
      toChainId: ARBITRUM,
      connectorType: "injected",
      via: "appkit",
    });
  });

  it("says a switch is already waiting when wagmi wraps the wallet's pending answer", async () => {
    // wagmi's injected connector puts a failure it does not recognise inside
    // viem's SwitchChainError, whose own code says "unknown network".
    const { config, connector } = wallet({ type: "injected" });
    connector.switchChain.mockRejectedValueOnce(
      new SwitchChainError(Object.assign(new Error("Request already pending"), { code: -32002 }))
    );

    await expect(ensureWagmiWalletChain(config, ARBITRUM)).rejects.toMatchObject({
      message: expect.stringContaining("Network switch already pending"),
      outcome: "pending",
    });
  });

  it("fails as a wallet to reconnect when its connector cannot report a network", async () => {
    // While wagmi reconnects, the connector is a stored stub.
    const { config, connector } = wallet();
    Object.assign(connector, { getChainId: undefined });

    await expect(ensureWagmiWalletChain(config, ARBITRUM)).rejects.toThrow(
      "Connector not connected"
    );
    expect(connector.switchChain).not.toHaveBeenCalled();
  });

  it("takes the string id AppKit reports for an unlisted network as the wallet's network", async () => {
    const { config, connector } = wallet({ stored: ARBITRUM, connector: String(BASE) });

    await ensureWagmiWalletChain(config, ARBITRUM);

    expect(connector.switchChain).toHaveBeenCalledOnce();
  });

  it("never waits on a switch another act left open when the wallet is already on its network", async () => {
    const { config, connector } = wallet({ connector: ARBITRUM });
    // A G$ send asks for Celo, and the wallet's prompt is left unanswered.
    connector.switchChain.mockImplementationOnce(() => new Promise(() => undefined));
    void ensureWagmiWalletChain(config, CELO);

    await expect(ensureWagmiWalletChain(config, ARBITRUM)).resolves.toBeUndefined();
  });

  it("guards a wallet that stays connected while another connection is being opened", async () => {
    // wagmi reports "not connected" for that moment, yet a write still goes
    // through the wallet that is.
    const { config, connector } = wallet();
    (config.state as { status: string }).status = "connecting";

    await ensureWagmiWalletChain(config, ARBITRUM);

    expect(connector.switchChain).toHaveBeenCalledOnce();
  });

  it("fails as a wallet to reconnect when it stops reporting a network during the switch", async () => {
    const { config, connector } = wallet();
    connector.switchChain.mockImplementationOnce(async ({ chainId }) => {
      // The session ends while the switch is open.
      connector.getChainId.mockRejectedValue(new Error("session ended"));
      connector.getProvider.mockRejectedValue(new Error("session ended"));
      return { id: chainId };
    });

    await expect(ensureWagmiWalletChain(config, ARBITRUM)).rejects.toThrow(
      "Connector not connected"
    );
    expect(mocks.trackSwitch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ outcome: "failed" })
    );
  });

  it("asks once when two writes need the same switch at the same time", async () => {
    const { config, connector } = wallet();

    await Promise.all([
      ensureWagmiWalletChain(config, ARBITRUM),
      ensureWagmiWalletChain(config, ARBITRUM, "retry"),
    ]);

    expect(connector.switchChain).toHaveBeenCalledOnce();
  });
});

describe("walletSwitchesQuietly", () => {
  it("is quiet for a WalletConnect session holding an account on the network, and never for a browser wallet", async () => {
    // WalletConnect's provider decides from the session's accounts; `chains` is optional.
    const session = {
      namespaces: {
        eip155: {
          accounts: [`eip155:${ARBITRUM}:0x1111111111111111111111111111111111111111`],
          chains: [`eip155:${ARBITRUM}`, `eip155:${CELO}`],
        },
      },
    };
    const phone = wallet({ session });
    await expect(walletSwitchesQuietly(phone.config, ARBITRUM)).resolves.toBe(true);
    await expect(walletSwitchesQuietly(phone.config, CELO)).resolves.toBe(false);

    const browser = wallet({ type: "injected", session });
    await expect(walletSwitchesQuietly(browser.config, ARBITRUM)).resolves.toBe(false);
  });
});

describe("readyWalletClient", () => {
  const OWNER = "0x1111111111111111111111111111111111111111";
  const SOMEONE_ELSE = "0x2222222222222222222222222222222222222222";

  // Regression: the write hooks took their client from wagmi at render. wagmi
  // hands out none while the connector's network and the stored one differ, so
  // those hooks stopped with "not connected" before any guard could switch.
  it("switches first, then hands back a client on the act's network for the address it was prepared for", async () => {
    const { config, connector } = wallet({ stored: ARBITRUM, connector: CELO });
    vi.mocked(getWagmiConfig).mockReturnValue(config);
    // What wagmi answers for this wallet before the guard has run.
    await expect(getWalletClient(config, { chainId: ARBITRUM })).rejects.toBeInstanceOf(
      ConnectorChainMismatchError
    );

    const client = await readyWalletClient(ARBITRUM, OWNER);

    expect(connector.switchChain).toHaveBeenCalledOnce();
    expect(client.chain.id).toBe(ARBITRUM);
    expect(client.account.address).toBe(OWNER);
  });

  it("refuses a wallet that changed hands before asking it to change network", async () => {
    const { config, connector } = wallet();
    vi.mocked(getWagmiConfig).mockReturnValue(config);

    await expect(readyWalletClient(ARBITRUM, SOMEONE_ELSE)).rejects.toMatchObject({
      code: "account_mismatch",
    });
    expect(connector.switchChain).not.toHaveBeenCalled();
  });

  it("gives no client for an address the wallet dropped while its switch was open", async () => {
    const { config, connector, on } = wallet();
    vi.mocked(getWagmiConfig).mockReturnValue(config);
    connector.switchChain.mockImplementationOnce(async ({ chainId }) => {
      on.connector = chainId;
      on.provider = chainId;
      const connection = config.state.connections.get("wallet") as unknown as {
        accounts: string[];
      };
      connection.accounts = [SOMEONE_ELSE];
      return { id: chainId };
    });

    await expect(readyWalletClient(ARBITRUM, OWNER)).rejects.toBeInstanceOf(
      ConnectorAccountNotFoundError
    );
  });

  it("fails as not connected when no wallet is, without asking anything", async () => {
    const { config, connector } = wallet();
    (config.state as { status: string }).status = "disconnected";
    (config.state as { current: string | null }).current = null;
    vi.mocked(getWagmiConfig).mockReturnValue(config);

    await expect(readyWalletClient(ARBITRUM, OWNER)).rejects.toBeInstanceOf(
      ConnectorNotConnectedError
    );
    expect(connector.getChainId).not.toHaveBeenCalled();
  });
});

describe("retryOnWalletChainMismatch", () => {
  const moved = () =>
    new BaseError("Contract write failed", {
      cause: new ChainMismatchError({ chain: arbitrum, currentChainId: CELO }),
    });

  it("checks again and retries once when viem refuses for the wallet's network, and returns a second refusal", async () => {
    const recheck = vi.fn().mockResolvedValue(undefined);
    const landsSecondTime = vi.fn().mockRejectedValueOnce(moved()).mockResolvedValueOnce("0xhash");

    await expect(retryOnWalletChainMismatch(landsSecondTime, recheck)).resolves.toBe("0xhash");
    expect(recheck).toHaveBeenCalledOnce();

    const neverLands = vi.fn().mockRejectedValue(moved());
    await expect(retryOnWalletChainMismatch(neverLands, recheck)).rejects.toBeInstanceOf(BaseError);
    expect(neverLands).toHaveBeenCalledTimes(2);
  });

  it("reports a check that fails before the second attempt as a write that was never signed", async () => {
    const refused = vi.fn().mockRejectedValue(moved());
    const changedHands = new Error("submission-ownership-changed");

    const failure = await retryOnWalletChainMismatch(refused, () =>
      Promise.reject(changedHands)
    ).catch((error: unknown) => error);

    // It reads as the failed check, and as a refusal before anything was signed.
    expect(failure).toMatchObject({ message: "submission-ownership-changed", cause: changedHands });
    expect(refusedForWalletNetwork(failure)).toBe(true);
    expect(refused).toHaveBeenCalledOnce();

    // A check that is itself a network refusal already says so, and passes as it is.
    const declined = Object.assign(new Error("Network switch rejected"), {
      name: "WalletChainMismatchError",
    });
    await expect(retryOnWalletChainMismatch(refused, () => Promise.reject(declined))).rejects.toBe(
      declined
    );
  });

  it("does not retry wagmi's connector refusal, which can follow an accepted batch, or any other failure", async () => {
    const recheck = vi.fn();
    const afterAccepting = vi
      .fn()
      .mockRejectedValue(
        new ConnectorChainMismatchError({ connectionChainId: ARBITRUM, connectorChainId: CELO })
      );
    await expect(retryOnWalletChainMismatch(afterAccepting, recheck)).rejects.toBeInstanceOf(
      ConnectorChainMismatchError
    );

    const rejected = vi.fn().mockRejectedValue(new Error("User rejected the request"));
    await expect(retryOnWalletChainMismatch(rejected, recheck)).rejects.toThrow("User rejected");

    expect(afterAccepting).toHaveBeenCalledOnce();
    expect(rejected).toHaveBeenCalledOnce();
    expect(recheck).not.toHaveBeenCalled();
  });
});
