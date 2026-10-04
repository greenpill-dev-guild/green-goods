/**
 * Failures the app raises itself before anything reaches the chain: the queue
 * already holds an earlier version of the act, the wallet is on another
 * network, or the phone is offline. Their words are the app's own, never a
 * contract's, so each names the translated copy its reader should see.
 *
 * @module utils/errors/unsent-failures
 */

import type { ParsedContractError } from "./contract-errors";
import { wrongWalletNetwork } from "./wallet-network-refusal";

/**
 * How the queue refuses a second, different act behind an identity it already
 * holds. The code names the queue ("offline job"), not the phone's connection.
 */
const QUEUE_IDENTITY_CONFLICT = "offline_job_identity_conflict:";

/**
 * The queue's refusal or a wallet-network failure, read before any single word
 * in its message ("offline", "connection", "rejected") is taken for something
 * else. Null for every other error.
 */
export function parseUnsentFailure(error: unknown, message: string): ParsedContractError | null {
  if (message.includes(QUEUE_IDENTITY_CONFLICT)) {
    return {
      raw: message,
      name: "EarlierVersionQueued",
      message: "An earlier version of this is still on this phone. Send it or discard it first.",
      titleKey: "app.errors.queue.earlierVersion.title",
      messageKey: "app.errors.queue.earlierVersion.message",
      isKnown: true,
      // The same press is refused again while the earlier version is queued.
      recoverable: false,
    };
  }

  const wrongNetwork = wrongWalletNetwork(error);
  if (!wrongNetwork) return null;
  const { network } = wrongNetwork;
  return {
    raw: message,
    name: "WalletOnAnotherNetwork",
    message: network
      ? `Your wallet needs to be on ${network} for this. Switch it there, then try again.`
      : "Your wallet is on a different network than this needs. Switch networks in your wallet, then try again.",
    titleKey: "app.errors.wallet.wrongNetwork.title",
    messageKey: network
      ? "app.errors.wallet.wrongNetwork.message"
      : "app.errors.wallet.wrongNetwork.messageUnnamed",
    ...(network ? { messageValues: { network } } : {}),
    isKnown: true,
    recoverable: true,
    suggestedAction: "check-wallet",
  };
}

/** The phone has no connection. */
export function offlineFailure(raw: string): ParsedContractError {
  return {
    raw,
    name: "Offline",
    message: "You're offline. Your work is saved and will sync when you reconnect.",
    titleKey: "app.errors.offline.title",
    messageKey: "app.errors.offline.message",
    isKnown: true,
    recoverable: true,
    suggestedAction: "retry",
  };
}
