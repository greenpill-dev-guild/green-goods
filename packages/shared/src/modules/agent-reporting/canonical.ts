import { type Hex, keccak256, stringToBytes } from "viem";

/**
 * Versioned canonical encoding for everything a confirmation, signature or permission binds to.
 *
 * Browser and Agent must derive identical digests from the same value, so the encoding is fixed:
 * object keys sorted by code point, no whitespace, integers only for numbers that denote counts or
 * versions, and bigint rendered as a decimal string. Values the encoding cannot represent exactly
 * are rejected rather than silently normalized.
 */
export type ReportingDigestKind =
  | "report-content"
  | "report-summary"
  | "review-content"
  | "review-summary"
  | "action-definition"
  | "publication-envelope"
  | "grant-policy"
  | "continuation-resource";

const ENCODING_VERSION = "v1";

export class CanonicalEncodingError extends Error {}

function encode(value: unknown, path: string): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value.normalize("NFC"));
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new CanonicalEncodingError(`${path} is not finite`);
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case "bigint":
      return JSON.stringify(value.toString(10));
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((item, index) => encode(item, `${path}[${index}]`)).join(",")}]`;
      }
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
      return `{${entries
        .map(([key, entry]) => `${JSON.stringify(key)}:${encode(entry, `${path}.${key}`)}`)
        .join(",")}}`;
    }
    default:
      throw new CanonicalEncodingError(`${path} has unsupported type ${typeof value}`);
  }
}

export function canonicalJson(value: unknown): string {
  return encode(value, "$");
}

/** Domain-separated so a digest of one kind can never stand in for another. */
export function reportingDigest(kind: ReportingDigestKind, value: unknown): Hex {
  return keccak256(
    stringToBytes(
      `green-goods/agent-reporting/${kind}/${ENCODING_VERSION}\n${canonicalJson(value)}`
    )
  );
}
