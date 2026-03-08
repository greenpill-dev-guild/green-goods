import { extractErrorMessage } from "./extract-message";

export type TxErrorKind = "cancelled" | "reverted" | "rpc" | "network" | "unknown";
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

function isUserCancelled(error: unknown, normalizedMessage: string): boolean {
  const code = extractErrorCode(error);
  if (code === USER_REJECTED_CODE || code === "ACTION_REJECTED") {
    return true;
  }
  return includesAny(normalizedMessage, CANCELLED_PATTERNS);
}

export function classifyTxError(error: unknown): TxErrorView {
  const rawMessage = extractErrorMessage(error).trim();
  const normalizedMessage = rawMessage.toLowerCase();

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

export function isCancelledTxError(error: unknown): boolean {
  return classifyTxError(error).kind === "cancelled";
}

export function isMeaningfulTxErrorMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "undefined" || normalized === "null") return false;
  if (normalized.startsWith("[object ")) return false;
  return true;
}
