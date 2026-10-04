import { getChainName } from "../../config/chains";
import { extractErrorMessage } from "./extract-message";

/**
 * A write viem refused for the wallet's network that was not tried again,
 * because a check ahead of the second attempt failed. Nothing was signed. It
 * carries the failed check's message and keeps the check as `cause`, so it
 * reads as that failure wherever a message or a cause chain is inspected.
 */
export class WalletWriteNotRetriedError extends Error {
  readonly cause?: unknown;

  constructor(failedCheck: unknown) {
    super(failedCheck instanceof Error ? failedCheck.message : String(failedCheck));
    this.name = "WalletWriteNotRetriedError";
    this.cause = failedCheck;
  }
}

const NEVER_SIGNED = new Set([
  "ChainMismatchError",
  "WalletChainMismatchError",
  "WalletWriteNotRetriedError",
]);

/**
 * Whether a wallet write was refused for the wallet's network before the wallet
 * was asked to sign: viem's `ChainMismatchError`, raised only by its own check
 * ahead of the wallet request, the chain guard's `WalletChainMismatchError`, or
 * a `WalletWriteNotRetriedError` for a refused write that was never retried.
 * Nothing was signed or broadcast, so the write may run again and a send intent
 * recorded for it may be cleared.
 *
 * wagmi's `ConnectorChainMismatchError` is left out on purpose: wagmi also
 * raises it while waiting on an EIP-5792 batch the wallet has already accepted.
 */
export function refusedForWalletNetwork(error: unknown): boolean {
  const seen = new Set<object>();
  let cause = error;
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    if ("name" in cause && typeof cause.name === "string" && NEVER_SIGNED.has(cause.name))
      return true;
    cause = "cause" in cause ? cause.cause : undefined;
  }
  return false;
}

/**
 * Lower-case phrases that only a wallet on another network produces: the chain
 * guard's refusals, viem's and wagmi's mismatch checks, a switch that failed or
 * is not offered, and a chain the wallet or the app does not know. The job
 * queue keeps a failed send's message and nothing else, so the message has to
 * be enough. "Network" and "connection" alone are not here: wagmi's mismatch
 * says "connection's chain", and reading that as a lost connection told people
 * they were offline.
 */
const WRONG_NETWORK_PHRASES = [
  "walletchainmismatch",
  "chainmismatch",
  "chain mismatch",
  "connectorchainmismatch",
  "does not match the target chain",
  "does not match the connection's chain",
  "wrong chain",
  "wrong network",
  "wallet network",
  "switch your wallet",
  "switch wallet",
  "switch network",
  "switch chain",
  "chain switching",
  "unsupported chain",
  "unrecognized chain",
  "chain not configured",
  "network switch rejected",
  "network switch already pending",
];

/** Where each refusal names the network the write needed. */
const NEEDED_NETWORK_NAME = [
  /switch(?: your wallet)? to (.+?)(?: before continuing)?\./i,
  /\badd (.+?) in your wallet/i,
  /target chain for the transaction \(id: \d+ [–-] (.+?)\)/i,
];
const NEEDED_CHAIN_ID = /connection's chain \(id: (\d+)\)/i;

function knownChainName(chainId: number): string | null {
  const name = getChainName(chainId);
  return name === "Unknown" ? null : name;
}

function neededNetworkIn(message: string): string | null {
  for (const pattern of NEEDED_NETWORK_NAME) {
    const name = message.match(pattern)?.[1]?.trim();
    if (name) return name;
  }
  const chainId = message.match(NEEDED_CHAIN_ID)?.[1];
  return chainId ? knownChainName(Number(chainId)) : null;
}

/**
 * Reads a wallet-network failure off an error, or off its message alone: a
 * mismatch, a network switch that was declined, is pending or failed, or a
 * chain that is not supported. `network` is the one the write needed, when the
 * failure names it, so the person can be told where to switch.
 *
 * A declined switch counts here even though the wallet's own rejection sits
 * under it as `cause`: nothing was declined but the change of network, so it
 * must not read as a cancelled transaction.
 */
export function wrongWalletNetwork(error: unknown): { network: string | null } | null {
  const seen = new Set<object>();
  let wrongNetwork = false;
  let link = error;
  while (link !== null && link !== undefined && !(typeof link === "object" && seen.has(link))) {
    const message = extractErrorMessage(link);
    const lower = message.toLowerCase();
    const target =
      typeof link === "object" && "targetChainId" in link && typeof link.targetChainId === "number"
        ? link.targetChainId
        : undefined;
    if (target !== undefined || WRONG_NETWORK_PHRASES.some((phrase) => lower.includes(phrase))) {
      wrongNetwork = true;
      // The first link that names the network answers; a cause below may still name it.
      const network = target !== undefined ? knownChainName(target) : neededNetworkIn(message);
      if (network) return { network };
    }
    if (typeof link !== "object") break;
    seen.add(link);
    link = "cause" in link ? link.cause : undefined;
  }
  return wrongNetwork ? { network: null } : null;
}
