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

describe("account identity and ceremony encoding", () => {
  it.each([
    { id: "deadbeef", signingId: "3q2-7w", lengths: [4] },
    { id: "deadbeef", signingId: "deadbeef", lengths: [6] },
    { id: "deadbeef", signingId: undefined, lengths: [4, 6] },
    { id: "0xdeadbeef", signingId: undefined, lengths: [4, 7] },
  ])("keeps $id as identity and requests $lengths byte IDs", async ({ id, signingId, lengths }) => {
    const getFn = vi.fn<NonNullable<Parameters<typeof createPasskeyOwner>[2]>>(async () => null);
    const owner = createPasskeyOwner(
      { id, signingId, publicKey: "0x1234", raw: undefined as unknown as PublicKeyCredential },
      "greengoods.app",
      getFn
    );
    await expect(owner.sign({ hash: "0x010203" })).rejects.toThrow("Failed to request credential");
    const options = getFn.mock.calls[0]?.[0] as CredentialRequestOptions;
    expect(options.publicKey?.allowCredentials?.map(({ id: bytes }) => bytes.byteLength)).toEqual(
      lengths
    );
    expect(options.publicKey?.userVerification).toBe("required");
    expect(owner.id).toBe(id);
  });

  it("preserves Kernel factory data for both existing identities while fixing real ox signing", async () => {
    const { generateKeyPairSync, randomBytes, createHash, sign } = await import("node:crypto");
    const { createPublicClient, custom, zeroAddress } = await import("viem");
    const { entryPoint07Address, toWebAuthnAccount } = await import("viem/account-abstraction");
    const { toKernelSmartAccount } = await import("permissionless/accounts");
    const { publicKey: key, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = key.export({ format: "jwk" });
    const publicKey =
      `0x04${Buffer.from(jwk.x!, "base64url").toString("hex")}${Buffer.from(jwk.y!, "base64url").toString("hex")}` as `0x${string}`;
    const bytes = randomBytes(20);
    const signingId = bytes.toString("base64url");
    const hash = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
    const clientData = Buffer.from(
      JSON.stringify({
        type: "webauthn.get",
        challenge: Buffer.from(hash.slice(2), "hex").toString("base64url"),
        origin: "https://www.greengoods.app",
        crossOrigin: false,
      })
    );
    const authData = Buffer.concat([
      createHash("sha256").update("greengoods.app").digest(),
      Buffer.from([5, 0, 0, 0, 1]),
    ]);
    const der = sign(
      "sha256",
      Buffer.concat([authData, createHash("sha256").update(clientData).digest()]),
      privateKey
    );
    const buffer = (value: Buffer) => Uint8Array.from(value).buffer;
    const client = createPublicClient({
      transport: custom({
        request: async ({ method }) => {
          if (method === "eth_getCode") return "0x";
          throw new Error(`Unexpected RPC: ${method}`);
        },
      }),
    });
    const factoryData: string[] = [];
    for (const id of [bytes.toString("hex"), signingId]) {
      const credential = {
        id,
        signingId,
        publicKey,
        raw: undefined as unknown as PublicKeyCredential,
      };
      const owner = createPasskeyOwner(credential, "greengoods.app", async (options) => {
        expect(Buffer.from(options!.publicKey!.allowCredentials![0].id as ArrayBuffer)).toEqual(
          bytes
        );
        return {
          id: signingId,
          response: {
            clientDataJSON: buffer(clientData),
            authenticatorData: buffer(authData),
            signature: buffer(der),
          },
        } as unknown as PublicKeyCredential;
      });
      await expect(owner.sign({ hash })).resolves.toMatchObject({
        signature: expect.stringMatching(/^0x/),
      });
      const factories = [];
      for (const candidate of [owner, toWebAuthnAccount({ credential })]) {
        const account = await toKernelSmartAccount({
          client,
          owners: [candidate],
          version: "0.3.1",
          entryPoint: { address: entryPoint07Address, version: "0.7" },
          address: zeroAddress,
        });
        factories.push((await account.getFactoryArgs()).factoryData!);
      }
      expect(factories[0]).toBe(factories[1]);
      factoryData.push(factories[0]);
    }
    expect(factoryData[0]).not.toBe(factoryData[1]);
  });
});
