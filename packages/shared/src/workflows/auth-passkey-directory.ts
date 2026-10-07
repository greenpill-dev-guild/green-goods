/**
 * Sign-in through the Green Goods passkey directory.
 *
 * The directory names the passkey's public key and the domain it was created under. The device
 * then proves it holds that passkey by signing a fresh challenge, which the app checks against
 * the directory's key before it opens the account.
 */

import type { Hex } from "viem";
import type { P256Credential } from "viem/account-abstraction";
import { getPasskeyRequestIds, type PasskeyCredential } from "../modules/auth/session";
import type { PasskeyDirectoryCredential } from "../public-contracts/passkey-directory";
import type { PasskeyAdapters } from "./auth-passkey-adapters";
import { PasskeyServerLookupError } from "./auth-passkey-errors";
import { matchesBrowserId } from "./auth-passkey-ids";

export type DirectorySignIn = {
  credential: PasskeyCredential;
  userName: string;
  /** The domain the passkey was created under; every later signature must name it too. */
  rpId: string;
  /**
   * True when this device remembers a different passkey. The address it remembers is a claim
   * about that passkey, so it says nothing about the account being opened now.
   */
  switchingAccounts: boolean;
};

/** A passkey's x and y as lower-case hex, with or without the `0x04` point prefix. */
function keyCoordinates(publicKey: Hex): string {
  const hex = publicKey.toLowerCase().replace(/^0x/, "");
  return hex.length === 130 && hex.startsWith("04") ? hex.slice(2) : hex;
}

/**
 * Returns null without a directory, or for a name the directory does not hold, so that older
 * accounts fall through to the hosted server.
 */
export async function signInWithDirectory(
  adapters: PasskeyAdapters,
  userName: string
): Promise<DirectorySignIn | null> {
  const directory = adapters.createDirectoryClient();
  if (!directory) return null;
  const context = adapters.buildRecoveryContext(userName);
  const listed = (await directory.getCredentials({ context }).catch((error: unknown) => {
    throw new PasskeyServerLookupError(error);
  })) as Partial<PasskeyDirectoryCredential>[];
  // A browser offers a passkey only for the domain it was created under, so the ceremony asks
  // for exactly that domain. An entry without one did not come from the directory.
  const rpId = listed.find((credential) => credential.rpId)?.rpId;
  const credentials = listed.filter(
    (credential): credential is PasskeyDirectoryCredential =>
      Boolean(rpId) && credential.rpId === rpId && Boolean(credential.id && credential.publicKey)
  );
  if (!rpId || credentials.length === 0) return null;

  const challenge = adapters.randomChallenge();
  const response = await adapters.getWebAuthnCredential({
    publicKey: {
      challenge: new Uint8Array(challenge),
      rpId,
      userVerification: "required",
      allowCredentials: credentials.flatMap((credential) =>
        getPasskeyRequestIds({ id: credential.id, signingId: credential.id }).map((id) => ({
          id,
          type: "public-key",
          transports: ["internal", "hybrid"],
        }))
      ),
      timeout: 60_000,
    },
  });
  if (!response) throw new Error("Passkey authentication was cancelled");
  const held = credentials.find((credential) =>
    matchesBrowserId({ id: credential.id, signingId: credential.id }, response.id)
  );
  // The account address follows the public key, so a key that does not match the device's
  // passkey would open a different account. Fail closed instead.
  const verified =
    held !== undefined &&
    (await adapters.verifyAssertion({ response, publicKey: held.publicKey, challenge, rpId }));
  if (!held || !verified) throw new Error("Passkey server authentication failed");

  const remembered = adapters.session.getStoredCredential();
  return {
    credential: {
      id: held.id,
      signingId: response.id,
      publicKey: held.publicKey,
      raw: response as P256Credential["raw"],
    },
    userName: context.userName,
    rpId,
    switchingAccounts: remembered
      ? keyCoordinates(remembered.publicKey) !== keyCoordinates(held.publicKey)
      : false,
  };
}
