import { getPasskeyRequestIds, type PasskeyCredential } from "../modules/auth/session";

/**
 * Whether a stored credential is the one the browser just used. Stored IDs come in more than one
 * encoding, so the comparison is made on the bytes each of them stands for.
 */
export function matchesBrowserId(
  credential: Pick<PasskeyCredential, "id" | "signingId">,
  browserId: string
): boolean {
  try {
    const browserBytes = new Uint8Array(
      getPasskeyRequestIds({ id: browserId, signingId: browserId })[0]
    );
    return getPasskeyRequestIds(credential).some((id) => {
      const bytes = new Uint8Array(id);
      return (
        bytes.length === browserBytes.length &&
        bytes.every((byte, index) => byte === browserBytes[index])
      );
    });
  } catch {
    return false;
  }
}
