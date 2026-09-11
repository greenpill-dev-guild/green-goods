import { describe, expect, it, vi } from "vitest";
import type { P256Credential } from "viem/account-abstraction";
import { createPasskeyOwner } from "../../workflows/auth-passkey-adapters";

describe("createPasskeyOwner", () => {
  it("passes the browser credential ID and original RP ID to the signing ceremony", async () => {
    type CredentialGetter = NonNullable<Parameters<typeof createPasskeyOwner>[2]>;
    type PasskeyCredentialRequest = Parameters<CredentialGetter>[0];
    let capturedRequest: PasskeyCredentialRequest;
    const getCredential: CredentialGetter = vi.fn(async (request: PasskeyCredentialRequest) => {
      capturedRequest = request;
      throw new Error("stop after capturing request");
    });
    const credential: P256Credential = {
      // Base64url for the credential bytes de ad be ef. Treating this as hex
      // would ask the authenticator for a different credential.
      id: "3q2-7w",
      publicKey: "0x1234",
      raw: undefined as unknown as PublicKeyCredential,
    };
    const owner = createPasskeyOwner(credential, "greengoods.app", getCredential);

    await expect(owner.sign({ hash: "0x010203" })).rejects.toThrow("Failed to request credential");

    const credentialId = capturedRequest?.publicKey?.allowCredentials?.[0]?.id;
    const credentialBytes =
      credentialId instanceof ArrayBuffer
        ? new Uint8Array(credentialId)
        : new Uint8Array(
            credentialId?.buffer ?? new ArrayBuffer(0),
            credentialId?.byteOffset ?? 0,
            credentialId?.byteLength ?? 0
          );
    expect(capturedRequest?.publicKey?.rpId).toBe("greengoods.app");
    expect(Array.from(credentialBytes)).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });
});
