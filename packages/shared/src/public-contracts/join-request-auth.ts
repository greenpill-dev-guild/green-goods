import type { GardenJoinProofContent, GardenJoinProofEnvelope } from "./join-requests";

const AUTHORIZATION_PREFIX = "GG-JoinProof ";

function escapeProofField(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}

export function buildGardenJoinProofMessage(
  proof: Omit<GardenJoinProofEnvelope, "signature" | "factory" | "factoryData">,
  content: GardenJoinProofContent = {}
): string {
  const lines = [
    "Green Goods Garden Join Request",
    "Version: 1",
    `Chain ID: ${proof.chainId}`,
    `Garden: ${proof.gardenAddress.toLowerCase()}`,
    `Account: ${proof.accountAddress.toLowerCase()}`,
    `Action: ${proof.action}`,
    `Nonce: ${proof.nonce.toLowerCase()}`,
    `Issued at: ${proof.issuedAt}`,
    `Expires at: ${proof.expiresAt}`,
  ];
  if (proof.requestId) lines.push(`Request ID: ${escapeProofField(proof.requestId)}`);
  if (proof.cursor) lines.push(`Cursor: ${escapeProofField(proof.cursor)}`);
  if (proof.expectedRevision !== undefined) {
    lines.push(`Expected revision: ${proof.expectedRevision}`);
  }
  if (content.displayName !== undefined) {
    lines.push(`Display name: ${escapeProofField(content.displayName)}`);
  }
  if (content.note !== undefined) lines.push(`Note: ${escapeProofField(content.note ?? "")}`);
  if (content.reason !== undefined) lines.push(`Reason: ${escapeProofField(content.reason)}`);
  if (content.requestedVia !== undefined) lines.push(`Requested via: ${content.requestedVia}`);
  if (content.state !== undefined) lines.push(`State: ${content.state}`);
  if (content.limit !== undefined) lines.push(`Limit: ${content.limit}`);
  return lines.join("\n");
}

export function encodeGardenJoinAuthorization(proof: GardenJoinProofEnvelope): string {
  const bytes = new TextEncoder().encode(JSON.stringify(proof));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${AUTHORIZATION_PREFIX}${encoded}`;
}

export function decodeGardenJoinAuthorization(value: string | null | undefined): unknown {
  if (!value?.startsWith(AUTHORIZATION_PREFIX)) return null;
  const encoded = value.slice(AUTHORIZATION_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
  const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}
