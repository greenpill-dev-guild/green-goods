/**
 * Whether a wallet write was refused for the wallet's network before the wallet
 * was asked to sign: viem's `ChainMismatchError`, raised only by its own check
 * ahead of the wallet request, or the chain guard's `WalletChainMismatchError`.
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
    const name = "name" in cause ? cause.name : undefined;
    if (name === "ChainMismatchError" || name === "WalletChainMismatchError") return true;
    cause = "cause" in cause ? cause.cause : undefined;
  }
  return false;
}
