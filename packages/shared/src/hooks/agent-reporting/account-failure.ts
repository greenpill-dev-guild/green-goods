import { classifyAuthErrorReason, PasskeyNotFoundError } from "../../workflows/auth-passkey-errors";

/**
 * Why connecting or creating an account failed on a ceremony page's account step, in the terms
 * the step can act on: each reason has its own next step. None of them says the person has no
 * account, and none creates one. A prompt that closed says nothing about what the device holds.
 */
export type AccountFailureReason =
  /** The sign-in prompt closed without an answer: dismissed, timed out, or nothing to offer. */
  | "prompt_closed"
  /** The prompt closed while an account was being created, so none was. */
  | "not_created"
  /** This browser remembers no passkey to ask for. */
  | "no_saved_passkey"
  /** No account goes by the name that was given. */
  | "name_not_found"
  /** The device says it does not hold the passkey it was asked for. */
  | "passkey_not_here"
  /** The name chosen for a new account already belongs to one. */
  | "name_taken"
  /** This browser or page cannot open a passkey prompt. */
  | "passkeys_unavailable"
  /** The passkey directory could not be reached. */
  | "unreachable"
  /** Anything else: the account layer's own sentence says it. */
  | "other";

export interface AccountFailure {
  reason: AccountFailureReason;
  /** The account layer's sentence for it, in the reader's language. */
  spoken: string;
}

export function accountFailureReason(
  error: unknown,
  { creating }: { creating: boolean }
): AccountFailureReason {
  if (error instanceof PasskeyNotFoundError) {
    return error.scope === "name" ? "name_not_found" : "no_saved_passkey";
  }
  switch (classifyAuthErrorReason(error)) {
    case "cancelled":
      return creating ? "not_created" : "prompt_closed";
    case "credential_not_found":
      return "passkey_not_here";
    case "recovery_context_taken":
      return "name_taken";
    case "unsupported_context":
      return "passkeys_unavailable";
    case "server_unavailable":
      return "unreachable";
    default:
      return "other";
  }
}
