/**
 * Reading a passkey registration as the app's passkey client sends it, and the key it carries.
 */

import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { cose, decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";

type RegistrationTransports = NonNullable<RegistrationResponseJSON["response"]["transports"]>;

const TRANSPORTS = new Set(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);

/**
 * Accept the registration as the permissionless client sends it. That client mixes standard and
 * URL-safe base64 with padding; the verifier wants URL-safe without padding throughout.
 */
export function toRegistrationResponse(value: unknown): RegistrationResponseJSON | undefined {
  if (!isRecord(value) || !isRecord(value.response)) return undefined;
  const { id, rawId, response } = value;
  const { clientDataJSON, attestationObject, transports } = response;
  if (
    typeof id !== "string" ||
    typeof rawId !== "string" ||
    typeof clientDataJSON !== "string" ||
    typeof attestationObject !== "string"
  ) {
    return undefined;
  }
  return {
    id: toBase64Url(id),
    rawId: toBase64Url(rawId),
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON: toBase64Url(clientDataJSON),
      attestationObject: toBase64Url(attestationObject),
      ...(Array.isArray(transports)
        ? { transports: transports.filter(isTransport) as RegistrationTransports }
        : {}),
    },
  };
}

/** The challenge the device signed over, which names the sign-up this registration answers. */
export function readRegistrationChallenge(response: RegistrationResponseJSON): string | undefined {
  try {
    const clientData: unknown = JSON.parse(
      Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8")
    );
    return isRecord(clientData) && typeof clientData.challenge === "string"
      ? clientData.challenge
      : undefined;
  } catch {
    return undefined;
  }
}

/** The key as the app stores it: `0x04`, then the 32-byte x and y coordinates. */
export function uncompressedP256PublicKey(cosePublicKey: Uint8Array): `0x${string}` | undefined {
  try {
    const key = decodeCredentialPublicKey(
      cosePublicKey as Parameters<typeof decodeCredentialPublicKey>[0]
    );
    if (!cose.isCOSEPublicKeyEC2(key)) return undefined;
    const x = key.get(cose.COSEKEYS.x);
    const y = key.get(cose.COSEKEYS.y);
    if (key.get(cose.COSEKEYS.crv) !== cose.COSECRV.P256) return undefined;
    if (x?.length !== 32 || y?.length !== 32) return undefined;
    return `0x04${Buffer.from(x).toString("hex")}${Buffer.from(y).toString("hex")}`;
  } catch {
    return undefined;
  }
}

function isTransport(value: unknown): boolean {
  return typeof value === "string" && TRANSPORTS.has(value);
}

function toBase64Url(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
