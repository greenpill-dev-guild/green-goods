import type { AuthPasskeyReason } from "../modules/app/analytics-events";
import { withoutQuotedRequest } from "../utils/errors/extract-message";
import {
  hasErrorName,
  isPasskeyCredentialUnavailableError,
  PASSKEY_PROMPT_CLOSED_NAMES,
} from "../utils/errors/tx-error-classifier";

export class PasskeyServerLookupError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("Passkey server lookup failed: network or server unavailable");
    this.name = "PasskeyServerLookupError";
    this.cause = cause;
  }
}

/**
 * Sign-in had no passkey to ask for, so no prompt was opened: this browser remembers none
 * (`device`), or none goes by the name that was given (`name`). Neither says the person has no
 * account. The passkey may be on another device, or the account may be a wallet's.
 */
export class PasskeyNotFoundError extends Error {
  readonly scope: "device" | "name";

  constructor(scope: "device" | "name") {
    super(
      scope === "device"
        ? "No passkey is saved on this device."
        : "No passkey credential found for that username."
    );
    this.name = "PasskeyNotFoundError";
    this.scope = scope;
  }
}

const TRANSPORT_ERROR_NAMES = new Set(["HttpRequestError", "TimeoutError", "RpcRequestError"]);
/** WebAuthn refusals that come from the browser or the page, not from anything the person did. */
const UNSUPPORTED_ERROR_NAMES = new Set(["NotSupportedError", "SecurityError"]);

export function classifyAuthErrorReason(error: unknown): AuthPasskeyReason {
  if (error instanceof PasskeyServerLookupError) return "server_unavailable";
  if (error instanceof PasskeyNotFoundError) return "credential_not_found";
  if (isPasskeyCredentialUnavailableError(error)) return "credential_not_found";
  const name = error instanceof Error ? error.name : "";
  // A passkey server's refusal quotes the request, typed name included. Read only what failed:
  // this reason also decides whether sign-in falls back to the account the device remembers.
  const message = withoutQuotedRequest(
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  if (
    // A library may wrap the browser's rejection, as creating a passkey does.
    hasErrorName(error, PASSKEY_PROMPT_CLOSED_NAMES) ||
    message.includes("cancel") ||
    message.includes("abort") ||
    message.includes("notallowed")
  ) {
    return "cancelled";
  }
  if (hasErrorName(error, UNSUPPORTED_ERROR_NAMES)) return "unsupported_context";
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
