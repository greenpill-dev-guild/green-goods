/**
 * A wallet that never answers must not hold wagmi's restore for the rest of the visit (PRD-1575).
 * Real wagmi: its `reconnect()` skips a restore asked for while an earlier one runs.
 */
import { createConfig, createConnector, reconnect } from "@wagmi/core";
import { type Address, http } from "viem";
import { sepolia } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  boundConnectorRestores,
  CONNECTOR_RESTORE_DEADLINE_MS,
} from "../../../modules/auth/connector-restore-deadline";

const ACCOUNT = "0x1234567890abcdef1234567890abcdef12345678" as Address;
const never = <T>() => new Promise<T>(() => {});

/** A browser wallet on the device that never answers. */
const silentWallet = createConnector(() => ({
  id: "silent",
  name: "Silent Wallet",
  type: "injected",
  connect: never,
  disconnect: async () => {},
  getAccounts: () => never<readonly Address[]>(),
  getChainId: async () => sepolia.id,
  getProvider: async () => ({ wallet: "silent" }),
  isAuthorized: () => never<boolean>(),
  onAccountsChanged: () => {},
  onChainChanged: () => {},
  onDisconnect: () => {},
}));

/** A WalletConnect session that still holds the account and answers at once. */
const answeringSession = createConnector(() => ({
  id: "walletConnect",
  name: "WalletConnect",
  type: "walletConnect",
  connect: (async () => ({ accounts: [ACCOUNT], chainId: sepolia.id })) as never,
  disconnect: async () => {},
  getAccounts: async () => [ACCOUNT],
  getChainId: async () => sepolia.id,
  getProvider: async () => ({ wallet: "walletConnect" }),
  isAuthorized: async () => true,
  onAccountsChanged: () => {},
  onChainChanged: () => {},
  onDisconnect: () => {},
}));

function launch(bounded: boolean) {
  const config = createConfig({
    chains: [sepolia],
    connectors: [silentWallet],
    transports: { [sepolia.id]: http() },
    storage: null,
    multiInjectedProviderDiscovery: false,
  });
  if (bounded) boundConnectorRestores(config);
  // The launch restore asks the silent wallet.
  void reconnect(config);
  return config;
}

/** AppKit registers the WalletConnect session a moment after launch and restores it. */
async function walletConnectRegisters(config: ReturnType<typeof launch>) {
  const session = config._internal.connectors.setup(answeringSession);
  config._internal.connectors.setState((connectors) => [...connectors, session]);
  return reconnect(config, { connectors: [session] });
}

describe("restoring a wallet session past a wallet that never answers", () => {
  afterEach(() => vi.useRealTimers());

  it("lets the App's next restore reach the WalletConnect session", async () => {
    vi.useFakeTimers();
    const config = launch(true);
    await vi.advanceTimersByTimeAsync(500);
    // Still skipped while the launch restore waits on the silent wallet.
    expect(await walletConnectRegisters(config)).toEqual([]);

    // The silent wallet's time limit ends the launch restore with no wallet.
    await vi.advanceTimersByTimeAsync(CONNECTOR_RESTORE_DEADLINE_MS);
    expect(config.state.status).toBe("disconnected");

    // The App asks again: the silent wallet is passed over and the session answers.
    const retry = reconnect(config);
    await vi.advanceTimersByTimeAsync(CONNECTOR_RESTORE_DEADLINE_MS);
    const connections = await retry;
    expect(connections.map((connection) => connection.connector.id)).toEqual(["walletConnect"]);
    expect(config.state.status).toBe("connected");
  });

  it("without a time limit, the silent wallet holds every later restore", async () => {
    vi.useFakeTimers();
    const config = launch(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(await walletConnectRegisters(config)).toEqual([]);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(await reconnect(config)).toEqual([]);
    expect(config.state.status).toBe("connecting");
  });

  it("bounds a silent wallet announced after launch, as an EIP-6963 wallet is", async () => {
    vi.useFakeTimers();
    const config = launch(true);
    await vi.advanceTimersByTimeAsync(CONNECTOR_RESTORE_DEADLINE_MS);
    const late = config._internal.connectors.setup(silentWallet);
    config._internal.connectors.setState((connectors) => [...connectors, late]);

    let settled = false;
    void late.isAuthorized().then(
      () => (settled = true),
      () => (settled = true)
    );
    await vi.advanceTimersByTimeAsync(CONNECTOR_RESTORE_DEADLINE_MS);
    expect(settled).toBe(true);
  });

  it("leaves a connect the person starts without a time limit", async () => {
    vi.useFakeTimers();
    const config = launch(true);
    const [silent] = config.connectors;
    let settled = false;
    void silent.connect().then(
      () => (settled = true),
      () => (settled = true)
    );
    await vi.advanceTimersByTimeAsync(CONNECTOR_RESTORE_DEADLINE_MS * 4);
    expect(settled).toBe(false);
  });
});
