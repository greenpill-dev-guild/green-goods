/**
 * Checking a passkey assertion against the key a directory holds for it.
 *
 * The app runs this before it opens an account, and the agent runs it before it binds a name to a
 * passkey, so both sides use one implementation. It takes the assertion's bytes rather than a
 * browser `Credential`: the app reads them from the ceremony's response, and the agent decodes them
 * from a request.
 */

const USER_PRESENT = 0x01;
const USER_VERIFIED = 0x04;
const RP_ID_HASH_LENGTH = 32;
const COORDINATE_LENGTH = 32;

export type PasskeyAssertionBytes = {
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  /** The signature as the authenticator returns it, DER encoded. */
  signature: Uint8Array;
  /** The key the directory holds for the passkey: x and y, with or without the 0x04 prefix. */
  publicKey: `0x${string}`;
  /** The exact bytes sent as the challenge. */
  challenge: Uint8Array;
  /** The domain the ceremony was run for. */
  rpId: string;
  /** The page that ran the ceremony. */
  origin: string;
};

/**
 * Whether the assertion is a sign-in, for this challenge, page and domain, with the person present
 * and verified, signed by the given key. A failed check returns false. Input that can't be read at
 * all (client data that isn't JSON, a key that isn't a P-256 point, a signature that isn't DER)
 * throws, so a caller can log it.
 */
export async function verifyPasskeyAssertionBytes(input: PasskeyAssertionBytes): Promise<boolean> {
  const { authenticatorData, clientDataJSON } = input;
  const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON)) as {
    type?: unknown;
    challenge?: unknown;
    origin?: unknown;
  };
  if (clientData.type !== "webauthn.get") return false;
  if (clientData.challenge !== toBase64Url(input.challenge)) return false;
  if (clientData.origin !== input.origin) return false;

  const rpIdHash = await sha256(new TextEncoder().encode(input.rpId));
  if (authenticatorData.length <= RP_ID_HASH_LENGTH) return false;
  if (!equalBytes(authenticatorData.subarray(0, RP_ID_HASH_LENGTH), rpIdHash)) return false;
  const flags = authenticatorData[RP_ID_HASH_LENGTH];
  if ((flags & USER_PRESENT) === 0 || (flags & USER_VERIFIED) === 0) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(uncompressedPoint(input.publicKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  // A passkey signs its authenticator data followed by the hash of the client data.
  const signed = concat(authenticatorData, await sha256(clientDataJSON));
  return await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    toArrayBuffer(derSignatureToRaw(input.signature)),
    toArrayBuffer(signed)
  );
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes)));
}

/** The point as WebCrypto imports it: 0x04, then x and y. */
function uncompressedPoint(publicKey: `0x${string}`): Uint8Array {
  const hex = publicKey.replace(/^0x/, "");
  const bytes = Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
  if (bytes.length === 2 * COORDINATE_LENGTH) return concat(Uint8Array.of(0x04), bytes);
  if (bytes.length === 2 * COORDINATE_LENGTH + 1 && bytes[0] === 0x04) return bytes;
  throw new Error("Passkey public key is not an uncompressed P-256 point");
}

/**
 * Authenticators sign in DER (a sequence of two integers); WebCrypto verifies the two values
 * laid side by side at a fixed width.
 */
function derSignatureToRaw(der: Uint8Array): Uint8Array {
  let offset = 0;
  const expectTag = (tag: number) => {
    if (der[offset++] !== tag) throw new Error("Passkey signature is not DER encoded");
  };
  const readLength = () => {
    const first = der[offset++];
    if ((first & 0x80) === 0) return first;
    let length = 0;
    for (let remaining = first & 0x7f; remaining > 0; remaining -= 1) {
      length = (length << 8) | der[offset++];
    }
    return length;
  };
  const readInteger = () => {
    expectTag(0x02);
    const length = readLength();
    const value = der.subarray(offset, offset + length);
    offset += length;
    return value;
  };

  expectTag(0x30);
  readLength();
  const raw = new Uint8Array(2 * COORDINATE_LENGTH);
  raw.set(fixedWidth(readInteger()), 0);
  raw.set(fixedWidth(readInteger()), COORDINATE_LENGTH);
  return raw;
}

/** Drop DER's sign padding and pad short values, so each integer fills one coordinate. */
function fixedWidth(integer: Uint8Array): Uint8Array {
  let start = 0;
  while (start < integer.length - 1 && integer[start] === 0) start += 1;
  const trimmed = integer.subarray(start);
  if (trimmed.length > COORDINATE_LENGTH) throw new Error("Passkey signature value is too long");
  const padded = new Uint8Array(COORDINATE_LENGTH);
  padded.set(trimmed, COORDINATE_LENGTH - trimmed.length);
  return padded;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a, 0);
  joined.set(b, a.length);
  return joined;
}

/** WebCrypto wants a plain ArrayBuffer, not a view that may sit on a shared one. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
