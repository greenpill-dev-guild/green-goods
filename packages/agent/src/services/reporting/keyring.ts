import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

/**
 * Versioned key material for private reporting records.
 *
 * One list holds every key version, current first: `version:base64key` pairs, comma separated,
 * each key 32 bytes. The first entry seals new values and names new lookup aliases; older entries
 * keep earlier values readable and earlier aliases matchable until they are retired. Each
 * version's encryption and lookup (HMAC) keys are derived from its key with HKDF under separate
 * labels, so an HMAC alias can never be used to decrypt anything. Every sealed value names its key
 * version and is bound to a record context through AES-GCM associated data, so a ciphertext copied
 * into another row or column fails authentication instead of decrypting as the wrong record.
 */
export interface ReportingKeyring {
  seal(plaintext: string, context: string): string;
  open(sealed: string, context: string): string;
  /** Binary form for private media objects: version byte length, version, IV, ciphertext, tag. */
  sealBytes(plaintext: Uint8Array, context: string): Uint8Array;
  openBytes(sealed: Uint8Array, context: string): Uint8Array;
  /** Lookup versions accepted during intake, current first. */
  readonly lookupVersions: readonly string[];
  readonly currentLookupVersion: string;
  lookup(version: string, purpose: string, value: string): string;
}

class ReportingKeyringError extends Error {}

const VERSION_PATTERN = /^[a-z0-9][a-z0-9_-]{0,15}$/i;
const IV_BYTES = 12;
const TAG_BYTES = 16;

interface KeyVersion {
  version: string;
  encryption: Buffer;
  lookup: Buffer;
}

function derive(key: Buffer, purpose: "encryption" | "lookup"): Buffer {
  return Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), `gg-agent-reporting:${purpose}`, 32));
}

function parseKeys(raw: string): KeyVersion[] {
  const versions: KeyVersion[] = [];
  for (const entry of raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const separator = entry.indexOf(":");
    const version = separator > 0 ? entry.slice(0, separator) : "";
    const material = separator > 0 ? entry.slice(separator + 1) : "";
    if (!VERSION_PATTERN.test(version)) {
      throw new ReportingKeyringError("The reporting key list contains an invalid key version");
    }
    const key = Buffer.from(material, "base64");
    if (key.length !== 32) {
      throw new ReportingKeyringError(`Reporting key ${version} must decode to 32 bytes`);
    }
    if (versions.some((known) => known.version === version)) {
      throw new ReportingKeyringError(`The reporting key list repeats version ${version}`);
    }
    versions.push({
      version,
      encryption: derive(key, "encryption"),
      lookup: derive(key, "lookup"),
    });
  }
  if (versions.length === 0) throw new ReportingKeyringError("The reporting key list has no keys");
  return versions;
}

function associatedData(context: string): Buffer {
  return Buffer.from(`gg-agent-reporting:${context}`, "utf8");
}

export function createReportingKeyring(keys: string): ReportingKeyring {
  const versions = parseKeys(keys);
  const current = versions[0] as KeyVersion;
  const encryption = new Map(versions.map((entry) => [entry.version, entry.encryption]));
  const lookups = new Map(versions.map((entry) => [entry.version, entry.lookup]));

  return {
    lookupVersions: versions.map((entry) => entry.version),
    currentLookupVersion: current.version,
    seal(plaintext, context) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", current.encryption, iv);
      cipher.setAAD(associatedData(context));
      const body = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
      return `${current.version}.${iv.toString("base64url")}.${body.toString("base64url")}`;
    },
    open(sealed, context) {
      const [version, ivText, bodyText, ...rest] = sealed.split(".");
      const key = version ? encryption.get(version) : undefined;
      if (!key || !ivText || !bodyText || rest.length > 0) {
        throw new ReportingKeyringError("Sealed value has an unknown format or key version");
      }
      const body = Buffer.from(bodyText, "base64url");
      if (body.length < TAG_BYTES) throw new ReportingKeyringError("Sealed value is truncated");
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
      decipher.setAAD(associatedData(context));
      decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
      return Buffer.concat([
        decipher.update(body.subarray(0, body.length - TAG_BYTES)),
        decipher.final(),
      ]).toString("utf8");
    },
    sealBytes(plaintext, context) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", current.encryption, iv);
      cipher.setAAD(associatedData(context));
      const version = Buffer.from(current.version, "utf8");
      return Buffer.concat([
        Buffer.from([version.length]),
        version,
        iv,
        cipher.update(plaintext),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
    },
    openBytes(sealed, context) {
      const buffer = Buffer.from(sealed);
      const versionLength = buffer[0] ?? 0;
      const version = buffer.subarray(1, 1 + versionLength).toString("utf8");
      const key = encryption.get(version);
      const bodyStart = 1 + versionLength + IV_BYTES;
      if (!key || buffer.length < bodyStart + TAG_BYTES) {
        throw new ReportingKeyringError("Sealed object has an unknown format or key version");
      }
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        buffer.subarray(1 + versionLength, bodyStart)
      );
      decipher.setAAD(associatedData(context));
      decipher.setAuthTag(buffer.subarray(buffer.length - TAG_BYTES));
      return Buffer.concat([
        decipher.update(buffer.subarray(bodyStart, buffer.length - TAG_BYTES)),
        decipher.final(),
      ]);
    },
    lookup(version, purpose, value) {
      const key = lookups.get(version);
      if (!key) throw new ReportingKeyringError(`Lookup key version ${version} is not configured`);
      return createHmac("sha256", key).update(`${purpose}\u0000${value}`, "utf8").digest("hex");
    },
  };
}
