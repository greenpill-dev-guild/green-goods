import type { ParsedContractError } from "./contract-errors";
import { extractErrorMessage } from "./extract-message";
import { wrongWalletNetwork } from "./wallet-network-refusal";

// An act refused because the wallet has not answered, already asked to reconnect (PRD-1499).
export { wasAskedToReconnect } from "./unsent-failures";

export type TxErrorKind =
  | "cancelled"
  | "unconfirmed"
  | "overCeilings"
  | "pastCeilings"
  | "passkeyUnavailable"
  | "wrongChain"
  | "reverted"
  | "rpc"
  | "network"
  | "unknown";
export type TxErrorSeverity = "warning" | "error";

export interface TxErrorView {
  kind: TxErrorKind;
  severity: TxErrorSeverity;
  titleKey: string;
  messageKey: string;
  rawMessage: string;
}

const USER_REJECTED_CODE = 4001;

const CANCELLED_PATTERNS = [
  "user rejected",
  "user denied",
  "rejected by user",
  "user cancelled",
  "user canceled",
  "rejected the request",
  "user declined",
  "action_rejected",
  "transaction cancelled",
  "transaction canceled",
];

const PASSKEY_UNAVAILABLE_PATTERNS = [
  "no passkey available",
  "no passkey is available",
  "no passkeys available",
  "no passkeys are available",
  "no credential available",
  "no credential is available",
  "no credentials available",
  "no credentials are available",
  "no matching credential",
  "credential is not available",
  "credential not found",
  "could not find a passkey",
  "couldn't find a passkey",
  "not registered on this device",
];

const NETWORK_PATTERNS = [
  "network",
  "connection",
  "failed to fetch",
  "econnrefused",
  "disconnected",
];

const TIMEOUT_PATTERNS = ["timeout", "timed out", "deadline exceeded"];

const INSUFFICIENT_FUNDS_PATTERNS = [
  "insufficient funds",
  "insufficient balance",
  "insufficient eth",
  "not enough funds",
];

const REVERT_PATTERNS = [
  "execution reverted",
  "revert",
  "out of gas",
  "gas estimation failed",
  "intrinsic gas too low",
  "call_exception",
  "contractfunctionexecutionerror",
];

const NONCE_PATTERNS = [
  "nonce too low",
  "nonce too high",
  "replacement transaction underpriced",
  "transaction underpriced",
  "already known",
];

const RPC_PATTERNS = [
  "rpc",
  "internal json-rpc error",
  "json-rpc",
  "invalid argument",
  "invalid params",
];

function includesAny(haystack: string, patterns: string[]): boolean {
  return patterns.some((pattern) => haystack.includes(pattern));
}

function hasMessageInErrorChain(
  error: unknown,
  patterns: string[],
  depth = 0,
  seen = new Set<unknown>()
): boolean {
  if (depth > 4 || error === null || error === undefined || seen.has(error)) return false;
  seen.add(error);

  const message = extractErrorMessage(error).trim().toLowerCase();
  if (includesAny(message, patterns)) return true;
  if (typeof error !== "object") return false;

  const nested = error as { cause?: unknown; error?: unknown };
  return (
    hasMessageInErrorChain(nested.cause, patterns, depth + 1, seen) ||
    hasMessageInErrorChain(nested.error, patterns, depth + 1, seen)
  );
}

export function isPasskeyCredentialUnavailableError(error: unknown): boolean {
  return hasMessageInErrorChain(error, PASSKEY_UNAVAILABLE_PATTERNS);
}

function extractErrorCode(error: unknown): number | string | undefined {
  if (!error || typeof error !== "object") return undefined;

  const err = error as {
    code?: unknown;
    cause?: unknown;
    error?: unknown;
    data?: { originalError?: { code?: unknown } };
  };

  if (typeof err.code === "number" || typeof err.code === "string") {
    return err.code;
  }

  if (typeof err.data?.originalError?.code === "number") {
    return err.data.originalError.code;
  }

  const nested = extractErrorCode(err.cause ?? err.error);
  return nested;
}

/**
 * WebAuthn ceremony rejections raised when the passkey prompt closes without an answer. The
 * auth flow counts sign-in and account creation by the same set (`auth-passkey-errors.ts`); the
 * spec deliberately reuses `NotAllowedError` for a dismissal, a timeout and a device with no
 * passkey to offer, so matching it here keeps a declined passkey out of the failure funnel.
 */
export const PASSKEY_PROMPT_CLOSED_NAMES: ReadonlySet<string> = new Set([
  "NotAllowedError",
  "AbortError",
]);

/** Whether an error, or one it wraps as its `cause`, goes by one of the given names. */
export function hasErrorName(error: unknown, names: ReadonlySet<string>, depth = 0): boolean {
  if (depth > 4 || !(error instanceof Error)) return false;
  if (names.has(error.name)) return true;
  return hasErrorName((error as Error & { cause?: unknown }).cause, names, depth + 1);
}

function isUserCancelled(error: unknown, normalizedMessage: string): boolean {
  const code = extractErrorCode(error);
  if (code === USER_REJECTED_CODE || code === "ACTION_REJECTED") {
    return true;
  }
  if (hasErrorName(error, PASSKEY_PROMPT_CLOSED_NAMES)) {
    return true;
  }
  return includesAny(normalizedMessage, CANCELLED_PATTERNS);
}

/** One step is past its ceilings on its own, so there is no smaller send to fall back on. */
export const DEPOSIT_PAST_CEILINGS = "deposit-past-ceilings";

export function classifyTxError(error: unknown): TxErrorView {
  // The send went out and nobody can say whether it landed, so it must not read as failed or invite
  // another send. No raw text, because every surface prefers a meaningful raw message to the key.
  if (isUnconfirmedTxError(error)) {
    return {
      kind: "unconfirmed",
      severity: "warning",
      titleKey: "app.txFeedback.unconfirmed.title",
      messageKey: "app.txFeedback.unconfirmed.message",
      rawMessage: "",
    };
  }

  const rawMessage = extractErrorMessage(error).trim();
  const normalizedMessage = rawMessage.toLowerCase();

  if (normalizedMessage === "batch-budget-exceeded") {
    return {
      kind: "overCeilings",
      severity: "warning",
      titleKey: "app.txFeedback.overCeilings.title",
      messageKey: "app.txFeedback.overCeilings.message",
      rawMessage: "",
    };
  }

  if (normalizedMessage === DEPOSIT_PAST_CEILINGS) {
    return {
      kind: "pastCeilings",
      severity: "warning",
      titleKey: "app.txFeedback.pastCeilings.title",
      messageKey: "app.txFeedback.pastCeilings.message",
      rawMessage: "",
    };
  }

  if (isPasskeyCredentialUnavailableError(error)) {
    return {
      kind: "passkeyUnavailable",
      severity: "error",
      titleKey: "app.txFeedback.failed.title",
      messageKey: "app.errors.blockchain.passkeyUnavailable.message",
      rawMessage,
    };
  }

  if (isUserCancelled(error, normalizedMessage)) {
    return {
      kind: "cancelled",
      severity: "warning",
      titleKey: "app.txFeedback.cancelled.title",
      messageKey: "app.errors.blockchain.userRejected.message",
      rawMessage,
    };
  }

  if (includesAny(normalizedMessage, INSUFFICIENT_FUNDS_PATTERNS)) {
    return {
      kind: "reverted",
      severity: "error",
      titleKey: "app.txFeedback.failed.title",
      messageKey: "app.errors.blockchain.insufficientFunds.message",
      rawMessage,
    };
  }

  if (wrongWalletNetwork(rawMessage)) {
    return {
      kind: "wrongChain",
      severity: "error",
      titleKey: "app.txFeedback.failed.title",
      messageKey: "app.errors.blockchain.wrongChain.message",
      rawMessage,
    };
  }

  if (includesAny(normalizedMessage, TIMEOUT_PATTERNS)) {
    return {
      kind: "network",
      severity: "error",
      titleKey: "app.txFeedback.failed.title",
      messageKey: "app.errors.blockchain.timeout.message",
      rawMessage,
    };
  }

  if (includesAny(normalizedMessage, NETWORK_PATTERNS)) {
    return {
      kind: "network",
      severity: "error",
      titleKey: "app.txFeedback.failed.title",
      messageKey: "app.errors.blockchain.network.message",
      rawMessage,
    };
  }

  if (includesAny(normalizedMessage, REVERT_PATTERNS)) {
    return {
      kind: "reverted",
      severity: "error",
      titleKey: "app.txFeedback.failed.title",
      messageKey: "app.errors.blockchain.gasEstimation.message",
      rawMessage,
    };
  }

  if (includesAny(normalizedMessage, NONCE_PATTERNS)) {
    return {
      kind: "rpc",
      severity: "error",
      titleKey: "app.txFeedback.failed.title",
      messageKey: "app.errors.blockchain.nonce.message",
      rawMessage,
    };
  }

  if (includesAny(normalizedMessage, RPC_PATTERNS)) {
    return {
      kind: "rpc",
      severity: "error",
      titleKey: "app.txFeedback.failed.title",
      messageKey: "app.errors.blockchain.unknown.message",
      rawMessage,
    };
  }

  return {
    kind: "unknown",
    severity: "error",
    titleKey: "app.txFeedback.failed.title",
    messageKey: "app.errors.blockchain.unknown.message",
    rawMessage,
  };
}

const UNCONFIRMED_ERROR_NAMES: ReadonlySet<string> = new Set([
  "TransactionConfirmationPendingError",
  // A send's receipt that outlasted its wait's limit (PRD-1551): sent, and still confirming.
  "ReceiptWaitLimitError",
  "WaitForTransactionReceiptTimeoutError",
  "WaitForUserOperationReceiptTimeoutError",
]);

/**
 * Another send of the same thing still holds it, so this one sent nothing and has the same
 * answer: not yet known.
 */
export function isHeldByAnotherSend(error: unknown): boolean {
  return error instanceof Error && error.message === "batch-items-held";
}

export function isUnconfirmedTxError(error: unknown): boolean {
  return hasErrorName(error, UNCONFIRMED_ERROR_NAMES) || isHeldByAnotherSend(error);
}

const STOPPED_WAITING_NAMES: ReadonlySet<string> = new Set(["WalletAnswerAbandonedError"]);

/**
 * A send that must not be offered again: it went out with no receipt yet, or the person stopped
 * waiting while the wallet may still hold its request. Neither failed; a second send could land
 * twice (PRD-1551).
 */
export function mayStillLand(error: unknown): boolean {
  return isUnconfirmedTxError(error) || hasErrorName(error, STOPPED_WAITING_NAMES);
}

/**
 * How `parseContractError` reads a send that went out with no receipt yet (its wait outlasted
 * its limit, or the answer was a proposal or a lost reply): in the words `classifyTxError` uses,
 * never as failed, nor as a timeout that invites trying again (PRD-1551).
 */
/** The pending send's own answer, on the error or on one it wraps as its `cause`. */
function pendingSubmission(error: unknown, depth = 0): { awaiting?: string } | undefined {
  if (depth > 4 || !(error instanceof Error)) return undefined;
  const { submission, cause } = error as Error & {
    submission?: { awaiting?: string };
    cause?: unknown;
  };
  return submission ?? pendingSubmission(cause, depth + 1);
}

export function parseUnconfirmedSend(error: unknown, raw: string): ParsedContractError | null {
  if (!isUnconfirmedTxError(error)) return null;
  // A Safe proposal waits for the Safe's owners, not the network, and says so, even when a
  // stage error wraps it.
  if (pendingSubmission(error)?.awaiting === "safe-signers")
    return {
      raw,
      name: "SafeProposalPending",
      message:
        "Your Safe has the proposal. It goes through once enough of the Safe's owners sign it.",
      titleKey: "app.sendStage.safeSigners",
      messageKey: "app.sendStage.safeSigners.detail",
      isKnown: true,
      recoverable: false,
      suggestedAction: "check-wallet",
    };
  return {
    raw,
    name: "SendStillConfirming",
    message: "It could still go through, so wait a moment and check before you try again.",
    titleKey: "app.txFeedback.unconfirmed.title",
    messageKey: "app.txFeedback.unconfirmed.message",
    isKnown: true,
    recoverable: false,
    suggestedAction: "check-wallet",
  };
}

/** Some non-standard tokens revert on allowance(), which is not the same as a failed read. */
export function isRecoverableAllowanceReadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("revert") ||
    message.includes("execution reverted") ||
    message.includes("contractfunctionexecutionerror") ||
    message.includes("call_exception")
  );
}

export function isCancelledTxError(error: unknown): boolean {
  return classifyTxError(error).kind === "cancelled";
}

export function isMeaningfulTxErrorMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "undefined" || normalized === "null") return false;
  if (normalized.startsWith("[object ")) return false;
  if (normalized === "failed to request credential.") return false;
  if (includesAny(normalized, PASSKEY_UNAVAILABLE_PATTERNS)) return false;
  return true;
}
