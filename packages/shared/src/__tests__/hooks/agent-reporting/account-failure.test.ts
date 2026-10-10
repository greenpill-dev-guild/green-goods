import { describe, expect, it } from "vitest";
import { accountFailureReason } from "../../../hooks/agent-reporting/account-failure";
import {
  classifyAuthErrorReason,
  PasskeyNotFoundError,
  PasskeyServerLookupError,
} from "../../../workflows/auth-passkey-errors";

const named = (name: string, message: string, cause?: unknown) =>
  Object.assign(new Error(message), { name, cause });
/** What a browser says when its passkey prompt closes, whatever closed it. */
const promptClosed = () =>
  named("NotAllowedError", "The operation either timed out or was not allowed.");

/** @direct-test-subject ../../../hooks/agent-reporting/account-failure.ts
 * @direct-test-subject ../../../workflows/auth-passkey-errors.ts */
describe("why an attempt on the account step failed", () => {
  // Each row: what happened, whether an account was being created, what the page is told, and
  // how the attempt is counted.
  it.each([
    [
      "this browser remembers no passkey",
      new PasskeyNotFoundError("device"),
      false,
      "no_saved_passkey",
      "credential_not_found",
    ],
    [
      "no account goes by the name given",
      new PasskeyNotFoundError("name"),
      false,
      "name_not_found",
      "credential_not_found",
    ],
    ["the sign-in prompt closed", promptClosed(), false, "prompt_closed", "cancelled"],
    [
      "the creation prompt closed inside a library\'s own error",
      named(
        "WebAuthnP256.CredentialCreationFailedError",
        "Failed to create credential.",
        promptClosed()
      ),
      true,
      "not_created",
      "cancelled",
    ],
    [
      "the device says it holds no such passkey",
      named("NotAllowedError", "No passkey is available for this request."),
      false,
      "passkey_not_here",
      "credential_not_found",
    ],
    [
      "the name chosen is already an account\'s",
      new Error("That recovery name is already registered. Try recovery or choose another name."),
      true,
      "name_taken",
      "recovery_context_taken",
    ],
    [
      "the page may not run a passkey prompt",
      named("SecurityError", "The relying party ID is not equal to the current domain."),
      false,
      "passkeys_unavailable",
      "unsupported_context",
    ],
    [
      "the passkey directory cannot be reached",
      new PasskeyServerLookupError(new Error("fetch failed")),
      false,
      "unreachable",
      "server_unavailable",
    ],
    [
      "the device\'s passkey does not match the account\'s",
      new Error("Passkey server authentication failed"),
      false,
      "other",
      "verification_failed",
    ],
  ] as const)("reads %s", (_, error, creating, reason, counted) => {
    expect(accountFailureReason(error, { creating })).toBe(reason);
    expect(classifyAuthErrorReason(error)).toBe(counted);
  });

  it("never reads a closed prompt as a missing account, whichever act it closed on", () => {
    // The browser gives one answer for a dismissal, a timeout and a device with nothing to
    // offer, so neither reading may say the person has no account or needs a new one.
    expect(accountFailureReason(promptClosed(), { creating: false })).toBe("prompt_closed");
    expect(accountFailureReason(promptClosed(), { creating: true })).toBe("not_created");
  });
});
