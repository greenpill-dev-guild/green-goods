import {
  ConnectorNotConnectedError,
  getAccount,
  getWalletClient,
  switchChain,
  type Config,
} from "@wagmi/core";
import { getWagmiConfig, peekAppKit } from "../../config/appkit";
import type { Address } from "../../types/domain";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { getChainName } from "../../config/chains";
import {
  refusedForWalletNetwork,
  WalletWriteNotRetriedError,
} from "../../utils/errors/wallet-network-refusal";
import { logger } from "../app/logger";
import {
  trackWalletNetworkSwitch,
  type WalletNetworkSwitchOutcome,
  type WalletNetworkSwitchReason,
} from "../app/walletNetworkSwitchAnalytics";

const USER_REJECTED_REQUEST = 4001;
const REQUEST_ALREADY_PENDING = -32002;
const UNKNOWN_CHAIN = 4902;

type SwitchRefusal = Exclude<WalletNetworkSwitchOutcome, "switched">;

export class WalletChainMismatchError extends Error {
  readonly targetChainId: number;
  readonly walletChainId?: number;
  /** How the switch ended: what the person is told, and what telemetry records. */
  readonly outcome: SwitchRefusal;
  readonly cause?: unknown;

  constructor(params: {
    targetChainId: number;
    walletChainId?: number;
    outcome?: SwitchRefusal;
    cause?: unknown;
  }) {
    const outcome = params.outcome ?? "failed";
    const targetName = getChainName(params.targetChainId);
    const currentName =
      typeof params.walletChainId === "number" ? getChainName(params.walletChainId) : "Unknown";
    super(
      outcome === "rejected"
        ? `Network switch rejected. Approve the wallet prompt to switch to ${targetName} before continuing.`
        : outcome === "pending"
          ? `Network switch already pending. Open your wallet and approve the switch to ${targetName}.`
          : outcome === "unknown_network"
            ? `Wallet network is missing. Add ${targetName} in your wallet, then switch networks and try again.`
            : `Wrong wallet network. Switch your wallet to ${targetName} before continuing. Current wallet network: ${currentName}.`
    );
    this.name = "WalletChainMismatchError";
    this.targetChainId = params.targetChainId;
    this.walletChainId = params.walletChainId;
    this.outcome = outcome;
    if (params.cause !== undefined) this.cause = params.cause;
  }
}

/** Every numeric error code from the outermost wrapper down to the wallet's own error. */
function walletErrorCodes(error: unknown): number[] {
  const codes: number[] = [];
  const seen = new Set<object>();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const link = current as {
      code?: unknown;
      cause?: unknown;
      error?: unknown;
      data?: { originalError?: unknown };
    };
    if (typeof link.code === "number" || (typeof link.code === "string" && link.code !== "")) {
      const code = Number(link.code);
      if (Number.isInteger(code)) codes.push(code);
    }
    current = link.cause ?? link.data?.originalError ?? link.error;
  }
  return codes;
}

/**
 * What a failed switch request means. Connectors wrap the wallet's answer:
 * wagmi's injected connector puts any failure it does not recognise inside
 * viem's `SwitchChainError`, whose own code is 4902, so "unknown network" counts
 * only when it is the innermost code.
 */
function switchRefusal(error: unknown): SwitchRefusal {
  const codes = walletErrorCodes(error);
  if (codes.includes(USER_REJECTED_REQUEST)) return "rejected";
  if (codes.includes(REQUEST_ALREADY_PENDING)) return "pending";
  if (codes[codes.length - 1] === UNKNOWN_CHAIN) return "unknown_network";
  return "failed";
}

function toChainId(value: unknown): number | undefined {
  // AppKit reports a network outside the app's list by a decimal string, and a
  // provider answers `eth_chainId` in hex.
  const id = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

type WalletNetworks = { connector?: number; provider?: number };

/**
 * The networks the wallet reports now. Two readers must agree with a write's
 * network before it goes through: wagmi hands out a wallet client only for the
 * connector's network, and viem sends only on the provider's (`eth_chainId`).
 * They are separate values for WalletConnect, where AppKit's connector reports
 * AppKit's selected network. wagmi's stored network is never used: on
 * 2026-10-01 it said Arbitrum while a phone wallet's connector said Celo.
 */
async function readWalletNetworks(config: Config): Promise<WalletNetworks> {
  const { connector } = getAccount(config);
  const networks: WalletNetworks = {};
  // While wagmi reconnects, the connector is a stored stub that cannot answer.
  if (typeof connector?.getChainId !== "function") return networks;
  try {
    networks.connector = toChainId(await connector.getChainId());
  } catch (error) {
    logger.warn("Wallet connector could not report its network", {
      source: "chain-guard",
      error: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    const provider = (await connector.getProvider?.()) as
      | { request?: (args: { method: string }) => Promise<unknown> }
      | undefined;
    networks.provider = toChainId(await provider?.request?.({ method: "eth_chainId" }));
  } catch (error) {
    logger.warn("Wallet provider could not report its network", {
      source: "chain-guard",
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return networks;
}

function networkOtherThan(networks: WalletNetworks, chainId: number): number | undefined {
  // The provider is the wallet itself, so it names the network when the two differ.
  return [networks.provider, networks.connector].find((id) => id !== undefined && id !== chainId);
}

/** The network the wallet is on when that is not `chainId`: nothing when it is, or when it cannot say. */
export async function walletNetworkOtherThan(
  config: Config,
  chainId: number
): Promise<number | undefined> {
  return networkOtherThan(await readWalletNetworks(config), chainId);
}

/**
 * The same answer for a caller about to write through the wallet, where "cannot
 * say" is not an answer: a wallet that reports no network cannot be written
 * through either, and guessing from wagmi's stored network is what failed
 * before. That throws wagmi's `ConnectorNotConnectedError`.
 */
async function writableNetworkOtherThan(
  config: Config,
  chainId: number
): Promise<number | undefined> {
  const networks = await readWalletNetworks(config);
  if (networks.connector === undefined && networks.provider === undefined) {
    throw new ConnectorNotConnectedError();
  }
  return networkOtherThan(networks, chainId);
}

type WalletNetworkSwitch = { via: "appkit" | "wagmi"; run: () => Promise<unknown> };

function switchThroughWagmi(config: Config, chainId: number): WalletNetworkSwitch {
  return {
    via: "wagmi",
    run: () => switchChain(config, { chainId: chainId as Config["chains"][number]["id"] }),
  };
}

/**
 * How to move the wallet to `chainId`, decided before asking, so a refused
 * switch still reports which way it went.
 *
 * When AppKit owns the connection, its own switch moves the wallet and then its
 * selected network. Switching through wagmi alone leaves that selection behind
 * whenever wagmi already believes it is on the target, because AppKit follows
 * wagmi only when wagmi's network changes: the split the 2026-10-01 failures
 * showed. Without AppKit (tests, hosts that never mounted it) wagmi switches.
 */
function walletNetworkSwitch(config: Config, chainId: number): WalletNetworkSwitch {
  const appKit = peekAppKit();
  const network = appKit
    ?.getCaipNetworks("eip155")
    .find((candidate) => Number(candidate.id) === chainId);
  if (!appKit || !network) return switchThroughWagmi(config, chainId);
  return {
    via: "appkit",
    run: () =>
      appKit.switchNetwork(network, { throwOnFailure: true }).catch((error: unknown) => {
        // AppKit wraps every failure in its own error and keeps the wallet's
        // under `originalError`, where no rejection check looks.
        throw (error as { originalError?: unknown } | null)?.originalError ?? error;
      }),
  };
}

async function switchWallet(
  config: Config,
  walletChainId: number,
  targetChainId: number,
  reason: WalletNetworkSwitchReason
): Promise<void> {
  let via: WalletNetworkSwitch["via"] | undefined;
  const ask = async (step: WalletNetworkSwitch) => {
    via = step.via;
    try {
      await step.run();
    } catch (error) {
      throw new WalletChainMismatchError({
        targetChainId,
        walletChainId,
        outcome: switchRefusal(error),
        cause: error,
      });
    }
  };
  const connectorType = getAccount(config).connector?.type;
  const report = (outcome: WalletNetworkSwitchOutcome) =>
    trackWalletNetworkSwitch({
      reason,
      outcome,
      fromChainId: walletChainId,
      toChainId: targetChainId,
      connectorType,
      via,
    });

  try {
    const first = walletNetworkSwitch(config, targetChainId);
    await ask(first);
    // A wallet that dropped while the switch was open reports nothing, which
    // must not pass for a wallet that moved.
    let stillOn = await writableNetworkOtherThan(config, targetChainId);
    if (stillOn !== undefined && first.via === "appkit") {
      // AppKit moves only its own selection when it holds no account for the
      // wallet. The wallet itself is still elsewhere, so ask it through wagmi.
      await ask(switchThroughWagmi(config, targetChainId));
      stillOn = await writableNetworkOtherThan(config, targetChainId);
    }
    // A switch can resolve without moving the wallet. Writing anyway would only
    // trade this clear error for the write's network-mismatch refusal.
    if (stillOn !== undefined) {
      throw new WalletChainMismatchError({
        targetChainId,
        walletChainId: stillOn,
        outcome: "unconfirmed",
      });
    }
  } catch (error) {
    report(error instanceof WalletChainMismatchError ? error.outcome : "failed");
    throw error;
  }
  report("switched");
}

/** Switches under way, by wallet and by the network asked for. */
const switching = new WeakMap<Config, Map<number, Promise<void>>>();

/**
 * Put the connected wallet on `targetChainId` before it is asked to sign or
 * send, judging by the networks the wallet reports now (see
 * `readWalletNetworks`). A switch that is refused, or that leaves the wallet
 * elsewhere, throws `WalletChainMismatchError`; a wallet that cannot report its
 * network throws wagmi's `ConnectorNotConnectedError`. Nothing is asked of the
 * wallet afterwards.
 *
 * Callers that need the same switch at the same time share one request, so the
 * wallet is asked once and each of them gets its answer. A wallet already on
 * the network never waits on anyone else's switch.
 */
export async function ensureWagmiWalletChain(
  config: Config,
  targetChainId: number = DEFAULT_CHAIN_ID,
  reason: WalletNetworkSwitchReason = "write"
): Promise<void> {
  // Judged by the connection, not by wagmi's status: while another connection
  // is being opened wagmi reports "not connected", yet a write still goes
  // through the wallet that is.
  if (!getAccount(config).connector) return;
  const walletChainId = await writableNetworkOtherThan(config, targetChainId);
  if (walletChainId === undefined) return;

  const underWay = switching.get(config) ?? new Map<number, Promise<void>>();
  switching.set(config, underWay);
  let request = underWay.get(targetChainId);
  if (!request) {
    request = switchWallet(config, walletChainId, targetChainId, reason).finally(() => {
      underWay.delete(targetChainId);
    });
    underWay.set(targetChainId, request);
  }
  await request;
}

export async function ensureAppKitWalletChain(
  targetChainId: number = DEFAULT_CHAIN_ID
): Promise<void> {
  await ensureWagmiWalletChain(getWagmiConfig(), targetChainId);
}

/**
 * The connected wallet's client for one act on `chainId`, taken when the act
 * runs and only after the guard has put the wallet on that network.
 *
 * Write hooks take their client here, not from wagmi at render. wagmi's
 * `useWalletClient` hands out no client while the connector's network and the
 * one wagmi stored for the connection differ, so a hook that waited on it
 * stopped with "not connected" before its guard could switch anything.
 *
 * `account` is the address the act was prepared for: its checks, its
 * simulation, its form. Who signs is checked first, so a wallet swapped in
 * since then is refused before it is asked to change network, and the client
 * that comes back signs as that address or not at all. A wallet that is not
 * connected throws wagmi's `ConnectorNotConnectedError`.
 */
export async function readyWalletClient(chainId: number, account?: Address) {
  const config = getWagmiConfig();
  const connected = getAccount(config).address;
  if (account && connected) assertWalletAccount(account, connected);
  await ensureWagmiWalletChain(config, chainId);
  return getWalletClient(config, { chainId, account });
}

/**
 * Whether moving this wallet to `chainId` needs no prompt: a WalletConnect
 * session that holds the connected address on that network. WalletConnect's
 * provider decides from the session's accounts and not its optional `chains`
 * list, and then switches on the app's side. A session can hold a different
 * address on each network, and switching to one of those would change who
 * signs, so only the connected address counts. Any other network, and every
 * browser wallet, asks the person.
 */
export async function walletSwitchesQuietly(config: Config, chainId: number): Promise<boolean> {
  const { address, connector } = getAccount(config);
  if (connector?.type !== "walletConnect" || !address) return false;
  try {
    const provider = (await connector.getProvider?.()) as
      | { session?: { namespaces?: Record<string, { accounts?: string[] }> } }
      | undefined;
    const sameAddressOnChain = `eip155:${chainId}:${address}`.toLowerCase();
    return Object.values(provider?.session?.namespaces ?? {}).some((namespace) =>
      namespace.accounts?.some((account) => account.toLowerCase() === sameAddressOnChain)
    );
  } catch (error) {
    logger.warn("Could not read the WalletConnect session's accounts", {
      source: "chain-guard",
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Run one wallet write, and when viem refuses it because the wallet's network
 * moved after the guard ran, run `recheck` (the guard and the checks that
 * follow it) and the write once more. The refusal happens before the wallet is
 * asked to sign, so nothing was signed or broadcast and the second attempt
 * cannot send twice. A second refusal, and any other failure, goes back to the
 * caller. A check that fails ahead of the second attempt goes back as a
 * `WalletWriteNotRetriedError`, so it still reads as nothing signed.
 */
export async function retryOnWalletChainMismatch<T>(
  request: () => Promise<T>,
  recheck: () => Promise<void>
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!refusedForWalletNetwork(error)) throw error;
    logger.warn("Wallet network moved after the guard; checking again before one more attempt", {
      source: "chain-guard",
    });
    try {
      await recheck();
    } catch (failedCheck) {
      // Still nothing signed: viem refused the first attempt and no second one
      // is made. A check that is itself a network refusal already says so.
      throw refusedForWalletNetwork(failedCheck)
        ? failedCheck
        : new WalletWriteNotRetriedError(failedCheck);
    }
    return request();
  }
}

class WalletAccountMismatchError extends Error {
  readonly code = "account_mismatch";

  constructor() {
    super("Wallet account changed before submission");
    this.name = "WalletAccountMismatchError";
  }
}

export function assertWalletAccount(
  expectedAccount: Address,
  currentAccount: Address | undefined
): void {
  if (currentAccount?.toLowerCase() !== expectedAccount.toLowerCase()) {
    throw new WalletAccountMismatchError();
  }
}
