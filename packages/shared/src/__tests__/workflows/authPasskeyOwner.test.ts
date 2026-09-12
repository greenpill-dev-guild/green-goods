/**
 * Passkey owner signing ceremony.
 *
 * Exercised through the real viem and ox implementations rather than a mock of
 * `viem/account-abstraction`: the production failure lived in how ox encodes the
 * credential ID, so a mock would hide exactly the behaviour under test.
 */

import { type P256Credential, toWebAuthnAccount } from "viem/account-abstraction";
import { describe, expect, it, vi } from "vitest";

import { createPasskeyOwner } from "../../workflows/authServices";

// One 20-byte credential (the length Apple passkeys use), in both encodings it is stored in.
const CREDENTIAL_BYTES = [
  0x1f, 0x8b, 0x3c, 0xd2, 0x47, 0x90, 0xae, 0x05, 0x6e, 0xb1, 0x22, 0xf4, 0x9d, 0x38, 0xc7, 0x61,
  0x0a, 0xe5, 0x7b, 0x54,
];
/** How the passkey server reports it. */
const HEX_ID = "1f8b3cd24790ae056eb122f49d38c7610ae57b54";
/** How the browser reports it after a local registration. */
const BASE64URL_ID = "H4s80keQrgVusSL0nTjHYQrle1Q";

const RP_ID = "greengoods.app";

function credentialWithId(id: string): P256Credential {
  return {
    id,
    publicKey: "0x1234",
    raw: undefined as unknown as PublicKeyCredential,
  };
}

type CredentialGetter = NonNullable<Parameters<typeof createPasskeyOwner>[2]>;
type CredentialRequest = Parameters<CredentialGetter>[0];

function toBytes(source: ArrayBufferView | ArrayBuffer | undefined): number[] {
  if (!source) return [];
  const view = ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
  return Array.from(view);
}

/** Run a signing ceremony and return the request the authenticator would receive. */
async function captureCeremony(
  sign: (getCredential: CredentialGetter) => {
    sign: (parameters: { hash: `0x${string}` }) => Promise<unknown>;
  }
) {
  let request: CredentialRequest;
  const getCredential: CredentialGetter = vi.fn(async (options: CredentialRequest) => {
    request = options;
    return null;
  });

  await expect(sign(getCredential).sign({ hash: "0x010203" })).rejects.toThrow(
    "Failed to request credential"
  );

  return {
    request,
    credentialBytes: toBytes(request?.publicKey?.allowCredentials?.[0]?.id),
  };
}

describe("createPasskeyOwner", () => {
  it("names the real credential when the passkey server stored a hex ID", async () => {
    const { credentialBytes } = await captureCeremony((getCredential) =>
      createPasskeyOwner(credentialWithId(HEX_ID), RP_ID, getCredential)
    );

    expect(credentialBytes).toEqual(CREDENTIAL_BYTES);
  });

  it("keeps the credential ID the smart-account address is derived from", () => {
    const owner = createPasskeyOwner(credentialWithId(HEX_ID), RP_ID);

    expect(owner.id).toBe(HEX_ID);
  });

  it("leaves base64URL credential IDs from local registration unchanged", async () => {
    const owner = createPasskeyOwner(credentialWithId(BASE64URL_ID), RP_ID);
    const { credentialBytes } = await captureCeremony((getCredential) =>
      createPasskeyOwner(credentialWithId(BASE64URL_ID), RP_ID, getCredential)
    );

    expect(owner.id).toBe(BASE64URL_ID);
    expect(credentialBytes).toEqual(CREDENTIAL_BYTES);
  });

  it("keeps the RP ID and user verification ox requested", async () => {
    const { request } = await captureCeremony((getCredential) =>
      createPasskeyOwner(credentialWithId(HEX_ID), RP_ID, getCredential)
    );

    expect(request?.publicKey?.rpId).toBe(RP_ID);
    expect(request?.publicKey?.userVerification).toBe("required");
  });

  // Pins the premise of the fix. If a future viem or ox release starts decoding hex IDs
  // itself, this fails and the correction in createPasskeyOwner can be retired.
  it("guards against ox naming the wrong credential for a hex ID", async () => {
    const { credentialBytes } = await captureCeremony((getCredential) =>
      toWebAuthnAccount({ credential: credentialWithId(HEX_ID), rpId: RP_ID, getFn: getCredential })
    );

    expect(credentialBytes).not.toEqual(CREDENTIAL_BYTES);
  });
});
