import type { Hex } from "viem";
import type { P256Credential } from "viem/account-abstraction";
import { matchesBrowserId, type PasskeyCredential } from "../modules/auth/session";

export { matchesBrowserId } from "../modules/auth/session";

/** Keep the server identity while checking it names the credential the browser used. */
export function verifiedCredential(
  verification: { success?: boolean; id?: string; publicKey?: Hex },
  browserCredential: Pick<P256Credential, "id" | "raw">,
  failureMessage: string
): PasskeyCredential {
  if (
    !verification.success ||
    !verification.publicKey ||
    !verification.id ||
    !matchesBrowserId({ id: verification.id }, browserCredential.id)
  ) {
    throw new Error(failureMessage);
  }
  return {
    id: verification.id,
    signingId: browserCredential.id,
    publicKey: verification.publicKey,
    raw: browserCredential.raw,
  };
}
