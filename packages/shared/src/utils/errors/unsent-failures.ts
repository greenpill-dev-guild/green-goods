/**
 * Failures the app raises itself before anything reaches the chain: the queue
 * already holds an earlier version of the act, the wallet is on another
 * network, the phone is offline, a send that needs a connection had none, or a
 * jar review no longer matches the jar. Their words are the app's own, never a
 * contract's, so each names the translated copy its reader should see.
 *
 * @module utils/errors/unsent-failures
 */

import type { ParsedContractError } from "./contract-errors";
import { JarReviewChangedError, jarReviewChangedFailure } from "./hats-cookie-jar-errors";
import { wrongWalletNetwork } from "./wallet-network-refusal";

/**
 * A send refused before anything left the device, because the connection is
 * offline or unconfirmed, where nothing is kept to send later (the admin
 * cockpit's Submit Work). Read before any "offline" in a message is: here
 * nothing is saved to sync.
 */
export class ConnectionNeededError extends Error {
  constructor() {
    super("connection-needed: nothing was sent");
    this.name = "ConnectionNeededError";
  }
}

/**
 * How the queue refuses a second, different act behind an identity it already
 * holds. The code names the queue ("offline job"), not the phone's connection.
 */
const QUEUE_IDENTITY_CONFLICT = "offline_job_identity_conflict:";

/**
 * The queue's refusal, a send that needed a connection, an out-of-date jar
 * review, or a wallet-network failure, read before any single word in its
 * message ("offline", "connection", "rejected") is taken for something else.
 * Null for every other error.
 */
export function parseUnsentFailure(error: unknown, message: string): ParsedContractError | null {
  if (error instanceof ConnectionNeededError) return connectionNeededFailure(message);
  if (error instanceof JarReviewChangedError) return jarReviewChangedFailure(error);
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

/**
 * A send that needed a connection and had none, so nothing was sent. Where no
 * queue keeps the work, this replaces the offline copy's promise to sync.
 */
export function connectionNeededFailure(raw: string): ParsedContractError {
  return {
    raw,
    name: "ConnectionNeeded",
    message: "Nothing was sent. Check your connection, then try again.",
    titleKey: "app.errors.connectionNeeded.title",
    messageKey: "app.errors.connectionNeeded.message",
    isKnown: true,
    recoverable: true,
    suggestedAction: "retry",
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
