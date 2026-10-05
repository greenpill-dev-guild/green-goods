/**
 * A software authenticator for tests. It produces the registration a platform passkey would,
 * in the encoding the permissionless client sends, so the directory is exercised with real
 * WebAuthn structures.
 */

import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";

const USER_PRESENT = 0x01;
const USER_VERIFIED = 0x04;
const ATTESTED_CREDENTIAL_DATA = 0x40;
const ES256 = -7;

export type SoftwarePasskeyOptions = {
  /** The domain the authenticator binds the passkey to. */
  rpId: string;
  /** The page the browser reports the passkey was created on. */
  origin: string;
  /** The challenge exactly as the server issued it. */
  challenge: string;
  userVerified?: boolean;
  /** COSE algorithm the authenticator claims for its key. */
  algorithm?: number;
};

export type SoftwarePasskeyRegistration = {
  /** The registration as `pks_verifyRegistration` receives it. */
  credential: {
    id: string;
    rawId: string;
    response: { clientDataJSON: string; attestationObject: string; transports: string[] };
    authenticatorAttachment: "platform";
    clientExtensionResults: Record<string, never>;
    type: "public-key";
  };
  credentialId: string;
  /** `0x04`, then x and y: derived from the key itself, not from the attestation. */
  publicKey: `0x${string}`;
};

export function createSoftwarePasskeyRegistration(
  options: SoftwarePasskeyOptions
): SoftwarePasskeyRegistration {
  const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const x = Buffer.from(jwk.x ?? "", "base64url");
  const y = Buffer.from(jwk.y ?? "", "base64url");

  const coseKey = cborMap([
    [cborInt(1), cborInt(2)],
    [cborInt(3), cborInt(options.algorithm ?? ES256)],
    [cborInt(-1), cborInt(1)],
    [cborInt(-2), cborBytes(x)],
    [cborInt(-3), cborBytes(y)],
  ]);
  const credentialId = randomBytes(16);
  const flags =
    USER_PRESENT | ATTESTED_CREDENTIAL_DATA | (options.userVerified === false ? 0 : USER_VERIFIED);
  const authenticatorData = Buffer.concat([
    createHash("sha256").update(options.rpId).digest(),
    Buffer.from([flags]),
    Buffer.alloc(4),
    Buffer.alloc(16),
    Buffer.from([0, credentialId.length]),
    credentialId,
    coseKey,
  ]);
  const attestationObject = cborMap([
    [cborText("fmt"), cborText("none")],
    [cborText("attStmt"), cborMap([])],
    [cborText("authData"), cborBytes(authenticatorData)],
  ]);
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: "webauthn.create",
      challenge: options.challenge,
      origin: options.origin,
      crossOrigin: false,
    })
  );

  const id = credentialId.toString("base64url");
  return {
    credential: {
      id,
      rawId: id,
      response: {
        // The permissionless client sends standard base64 here and padded URL-safe base64 below.
        clientDataJSON: clientDataJSON.toString("base64"),
        attestationObject: padded(attestationObject.toString("base64url")),
        transports: ["internal"],
      },
      authenticatorAttachment: "platform",
      clientExtensionResults: {},
      type: "public-key",
    },
    credentialId: id,
    publicKey: `0x04${x.toString("hex")}${y.toString("hex")}`,
  };
}

function padded(value: string): string {
  return value + "=".repeat((4 - (value.length % 4)) % 4);
}

function cborHead(major: number, value: number): Buffer {
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value < 256) return Buffer.from([(major << 5) | 24, value]);
  return Buffer.from([(major << 5) | 25, value >> 8, value & 0xff]);
}

function cborInt(value: number): Buffer {
  return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value);
}

function cborBytes(value: Buffer): Buffer {
  return Buffer.concat([cborHead(2, value.length), value]);
}

function cborText(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([cborHead(3, bytes.length), bytes]);
}

function cborMap(entries: Array<[Buffer, Buffer]>): Buffer {
  return Buffer.concat([cborHead(5, entries.length), ...entries.flat()]);
}
