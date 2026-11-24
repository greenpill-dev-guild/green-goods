/**
 * Checking a passkey sign-in in the browser.
 *
 * The passkey directory tells the app which public key belongs to a name. Before the app opens
 * that account it asks the device to sign a fresh challenge and checks the signature against
 * the directory's key. An entry that does not match the passkey on the device then fails
 * closed, instead of opening a different and empty account.
 */

import type { Hex } from "viem";
import { verifyPasskeyAssertionBytes } from "../../public-contracts/passkey-assertion";
import { logger } from "../app/logger";

export type PasskeyAssertionCheck = {
  /** What `navigator.credentials.get` returned. */
  response: Credential;
  /** The key the directory holds for the passkey: x and y, with or without the 0x04 prefix. */
  publicKey: Hex;
  /** The exact bytes sent as the challenge. */
  challenge: Uint8Array;
  /** The domain the ceremony was run for. */
  rpId: string;
  /** The page that ran the ceremony. */
  origin: string;
};

/** The shared check, fed from the ceremony's response. A response it can't read fails closed. */
export async function verifyPasskeyAssertion(input: PasskeyAssertionCheck): Promise<boolean> {
  try {
    const assertion = (input.response as PublicKeyCredential)
      .response as AuthenticatorAssertionResponse;
    return await verifyPasskeyAssertionBytes({
      authenticatorData: new Uint8Array(assertion.authenticatorData),
      clientDataJSON: new Uint8Array(assertion.clientDataJSON),
      signature: new Uint8Array(assertion.signature),
      publicKey: input.publicKey,
      challenge: input.challenge,
      rpId: input.rpId,
      origin: input.origin,
    });
  } catch (error) {
    logger.warn("[Passkey] Sign-in response could not be checked", { error });
    return false;
  }
}
