import type { AuthPasskeyReason } from "../modules/app/analytics-events";
import { isPasskeyCredentialUnavailableError } from "../utils/errors/tx-error-classifier";

export class PasskeyServerLookupError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("Passkey server lookup failed: network or server unavailable");
    this.name = "PasskeyServerLookupError";
    this.cause = cause;
  }
}

const TRANSPORT_ERROR_NAMES = new Set(["HttpRequestError", "TimeoutError", "RpcRequestError"]);
const CANCELLED_ERROR_NAMES = new Set(["NotAllowedError", "AbortError"]);

export function classifyAuthErrorReason(error: unknown): AuthPasskeyReason {
  if (error instanceof PasskeyServerLookupError) return "server_unavailable";
  if (isPasskeyCredentialUnavailableError(error)) return "credential_not_found";
  const name = error instanceof Error ? error.name : "";
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (
    CANCELLED_ERROR_NAMES.has(name) ||
    message.includes("cancel") ||
    message.includes("abort") ||
    message.includes("notallowed")
  ) {
    return "cancelled";
  }
  if (
    message.includes("expected account") ||
    message.includes("address mismatch") ||
    message.includes("did not match the expected account")
  ) {
    return "address_mismatch";
  }
  if (message.includes("already registered") || message.includes("recovery name")) {
    return "recovery_context_taken";
  }
  if (
    TRANSPORT_ERROR_NAMES.has(name) ||
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("unavailable")
  ) {
    return "server_unavailable";
  }
  if (
    message.includes("verify") ||
    message.includes("verification") ||
    message.includes("registration failed") ||
    message.includes("authentication failed")
  ) {
    return "verification_failed";
  }
  if (
    message.includes("unsupported") ||
    message.includes("origin") ||
    message.includes("rp id") ||
    message.includes("rp_id")
  ) {
    return "unsupported_context";
  }
  return "unknown";
}
