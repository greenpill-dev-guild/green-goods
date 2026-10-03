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
