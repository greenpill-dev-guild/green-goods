import { createPublicClient, custom, encodeAbiParameters, type Hex } from "viem";
import { entryPoint07Address, type P256Credential } from "viem/account-abstraction";
import { arbitrum, celo } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";

const { factoryCalls } = vi.hoisted(() => ({
  factoryCalls: [] as { chainId: number; data: Hex }[],
}));
const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;

vi.mock("../../config/pimlico", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../config/pimlico")>();
  return {
    ...original,
    createPublicClientForChain: (chainId: number) =>
      createPublicClient({
        chain: chainId === 42220 ? celo : arbitrum,
        transport: custom({
          request: async ({ method }) => {
            if (method === "eth_getCode") return "0x";
            throw new Error(`Unexpected RPC method: ${method}`);
          },
        }),
      }).extend(() => ({
        call: async ({ data }: { data?: Hex }) => {
          if (!data) throw new Error("Factory call requires calldata");
          factoryCalls.push({ chainId, data });
          return { data: encodeAbiParameters([{ type: "address" }], [ACCOUNT]) };
        },
      })),
  };
});

import { createPasskeyOwner, defaultPasskeyAdapters } from "../../workflows/auth-passkey-adapters";

const credential: P256Credential = {
  id: "canary-test-credential",
  publicKey:
    "0x046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5",
  // Rebuilding uses the public credential only; no browser ceremony runs in this test.
  raw: undefined as unknown as P256Credential["raw"],
};

afterEach(() => {
  vi.unstubAllEnvs();
  factoryCalls.length = 0;
});

describe("passkey cross-chain account construction", () => {
  it("uses identical Kernel account factory calldata and EntryPoint 0.7 on Arbitrum and Celo", async () => {
    vi.stubEnv("VITE_PIMLICO_API_KEY", "test-api-key");
    vi.stubEnv("VITE_PIMLICO_SPONSORSHIP_POLICY_ID", "arbitrum-policy");
    vi.stubEnv("VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID", "celo-policy");
    const rpId = defaultPasskeyAdapters.getRpId();
    const primary = await defaultPasskeyAdapters.buildSmartAccount(credential, 42161, rpId);
    const settlement = await defaultPasskeyAdapters.buildSmartAccount(credential, 42220, rpId);
    expect(factoryCalls).toHaveLength(2);
    expect(factoryCalls[0].chainId).toBe(42161);
    expect(factoryCalls[1].chainId).toBe(42220);
    expect(factoryCalls[0].data).toBe(factoryCalls[1].data);
    expect(settlement.address).toBe(primary.address);
    expect(settlement.client.account!.entryPoint).toMatchObject({
      address: entryPoint07Address,
      version: "0.7",
    });
    const factoryArgs = await settlement.client.account!.getFactoryArgs();
    expect(factoryArgs.factory?.toLowerCase()).toBe("0xd703aae79538628d27099b8c4f621be4ccd142d5");
    expect(factoryArgs.factoryData?.toLowerCase()).toContain(
      "aac5d4240af87249b3f71bc8e4a2cae074a3e419"
    );
    expect(factoryArgs.factoryData?.toLowerCase()).toContain(
      "ba45a2bfb8de3d24ca9d7f1b551e14dff5d690fd"
    );
    expect(factoryArgs).toEqual(await primary.client.account!.getFactoryArgs());
    expect(primary.client.paymasterContext).toEqual({ sponsorshipPolicyId: "arbitrum-policy" });
    expect(settlement.client.paymasterContext).toEqual({ sponsorshipPolicyId: "celo-policy" });
  });

  it("constructs the Celo account with the general policy when no Celo override exists", async () => {
    vi.stubEnv("VITE_PIMLICO_API_KEY", "test-api-key");
    vi.stubEnv("VITE_PIMLICO_SPONSORSHIP_POLICY_ID", "arbitrum-policy");
    vi.stubEnv("VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID", undefined);
    const result = await defaultPasskeyAdapters.buildSmartAccount(
      credential,
      42220,
      defaultPasskeyAdapters.getRpId()
    );
    expect(result.address).toBe(ACCOUNT);
    expect(result.client.paymasterContext).toEqual({ sponsorshipPolicyId: "arbitrum-policy" });
    expect(factoryCalls).toHaveLength(1);
  });

  it("constructs the Celo account with the built-in general policy when nothing is configured", async () => {
    vi.stubEnv("VITE_PIMLICO_API_KEY", "test-api-key");
    vi.stubEnv("VITE_PIMLICO_SPONSORSHIP_POLICY_ID", undefined);
    vi.stubEnv("VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID", undefined);
    const result = await defaultPasskeyAdapters.buildSmartAccount(
      credential,
      42220,
      defaultPasskeyAdapters.getRpId()
    );
    expect(result.address).toBe(ACCOUNT);
    expect(result.client.paymasterContext).toEqual({
      sponsorshipPolicyId: "sp_next_monster_badoon",
    });
  });
});

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
