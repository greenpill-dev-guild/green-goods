// @vitest-environment node
import {
  createHash,
  createSign,
  generateKeyPairSync,
  type KeyObject,
  webcrypto,
} from "node:crypto";
import type { Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPasskeyAssertion } from "../../modules/auth/passkey-assertion";

// The shared test setup replaces `crypto` with a toy that cannot check a signature, so these
// tests hand the check the real WebCrypto a browser gives it.
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const RP_ID = "greengoods.app";
const ORIGIN = "https://beta.greengoods.app";
const CHALLENGE = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const USER_PRESENT = 0x01;
const USER_VERIFIED = 0x04;

type AssertionParts = {
  rpId: string;
  origin: string;
  challenge: Uint8Array;
  type: string;
  flags: number;
};

function keyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const coordinates =
    Buffer.from(jwk.x ?? "", "base64url").toString("hex") +
    Buffer.from(jwk.y ?? "", "base64url").toString("hex");
  return { privateKey, coordinates };
}

/** What a platform passkey returns for a sign-in: OpenSSL signs it, in DER like a real device. */
function signIn(privateKey: KeyObject, overrides: Partial<AssertionParts> = {}): Credential {
  const parts: AssertionParts = {
    rpId: RP_ID,
    origin: ORIGIN,
    challenge: CHALLENGE,
    type: "webauthn.get",
    flags: USER_PRESENT | USER_VERIFIED,
    ...overrides,
  };
  const authenticatorData = Buffer.concat([
    createHash("sha256").update(parts.rpId).digest(),
    Buffer.from([parts.flags]),
    Buffer.alloc(4),
  ]);
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: parts.type,
      challenge: Buffer.from(parts.challenge).toString("base64url"),
      origin: parts.origin,
      crossOrigin: false,
    })
  );
  const signature = createSign("SHA256")
    .update(
      Buffer.concat([authenticatorData, createHash("sha256").update(clientDataJSON).digest()])
    )
    .sign(privateKey);
  return {
    id: "credential",
    type: "public-key",
    response: {
      authenticatorData: arrayBuffer(authenticatorData),
      clientDataJSON: arrayBuffer(clientDataJSON),
      signature: arrayBuffer(signature),
    },
  } as unknown as Credential;
}

function arrayBuffer(bytes: Buffer): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function check(response: Credential, publicKey: Hex) {
  return verifyPasskeyAssertion({
    response,
    publicKey,
    challenge: CHALLENGE,
    rpId: RP_ID,
    origin: ORIGIN,
  });
}

describe("verifyPasskeyAssertion", () => {
  it("accepts the passkey that owns the key, whichever way the key is written", async () => {
    // Several keys, because a DER signature changes length with its leading bytes.
    for (let round = 0; round < 8; round += 1) {
      const { privateKey, coordinates } = keyPair();
      const response = signIn(privateKey);

      expect(await check(response, `0x04${coordinates}`)).toBe(true);
      expect(await check(response, `0x${coordinates}`)).toBe(true);
    }
  });

  it.each([
    ["answers a different challenge", { challenge: Uint8Array.from(CHALLENGE).reverse() }],
    ["was made on another site", { origin: "https://example.com" }],
    ["belongs to another domain", { rpId: "beta.greengoods.app" }],
    ["skipped user verification", { flags: USER_PRESENT }],
    ["is a registration, not a sign-in", { type: "webauthn.create" }],
  ] as const)("rejects a response that %s", async (_reason, overrides) => {
    const { privateKey, coordinates } = keyPair();

    expect(await check(signIn(privateKey, overrides), `0x04${coordinates}`)).toBe(false);
  });

  it("rejects a passkey that does not own the key, and a key that is not a P-256 point", async () => {
    const device = keyPair();
    const directoryEntry = keyPair();
    const response = signIn(device.privateKey);

    expect(await check(response, `0x04${directoryEntry.coordinates}`)).toBe(false);
    expect(await check(response, "0x1234")).toBe(false);
  });
});
