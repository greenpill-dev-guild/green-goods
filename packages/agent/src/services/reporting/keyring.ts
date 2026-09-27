import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * Versioned key material for private reporting records.
 *
 * Encryption and lookup (HMAC) keys are separate sets: rotating one never rewrites the other, and
 * an HMAC alias can never be used to decrypt anything. Every sealed value names its key version
 * and is bound to a record context through AES-GCM associated data, so a ciphertext copied into
 * another row or column fails authentication instead of decrypting as the wrong record.
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

export interface ReportingKeyringConfig {
  /** `version:base64key` pairs, comma separated. */
  encryptionKeys: string;
  currentEncryptionVersion: string;
  lookupKeys: string;
  currentLookupVersion: string;
}

class ReportingKeyringError extends Error {}

const VERSION_PATTERN = /^[a-z0-9][a-z0-9_-]{0,15}$/i;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function parseKeySet(label: string, raw: string): Map<string, Buffer> {
  const keys = new Map<string, Buffer>();
  for (const entry of raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const separator = entry.indexOf(":");
    const version = separator > 0 ? entry.slice(0, separator) : "";
    const material = separator > 0 ? entry.slice(separator + 1) : "";
    if (!VERSION_PATTERN.test(version)) {
      throw new ReportingKeyringError(`${label} contains an invalid key version`);
    }
    const key = Buffer.from(material, "base64");
    if (key.length !== 32) {
      throw new ReportingKeyringError(`${label} key ${version} must decode to 32 bytes`);
    }
    if (keys.has(version)) {
      throw new ReportingKeyringError(`${label} repeats key version ${version}`);
    }
    keys.set(version, key);
  }
  if (keys.size === 0) throw new ReportingKeyringError(`${label} has no keys`);
  return keys;
}

function associatedData(context: string): Buffer {
  return Buffer.from(`gg-agent-reporting:${context}`, "utf8");
}

export function createReportingKeyring(config: ReportingKeyringConfig): ReportingKeyring {
  const encryption = parseKeySet("Encryption key set", config.encryptionKeys);
  const lookups = parseKeySet("Lookup key set", config.lookupKeys);
  const current = encryption.get(config.currentEncryptionVersion);
  if (!current) {
    throw new ReportingKeyringError("The current encryption key version is not configured");
  }
  if (!lookups.has(config.currentLookupVersion)) {
    throw new ReportingKeyringError("The current lookup key version is not configured");
  }
  for (const encryptionKey of encryption.values()) {
    for (const lookupKey of lookups.values()) {
      if (encryptionKey.equals(lookupKey)) {
        throw new ReportingKeyringError("Encryption and lookup keys must be distinct");
      }
    }
  }

  const lookupVersions = [
    config.currentLookupVersion,
    ...[...lookups.keys()].filter((version) => version !== config.currentLookupVersion),
  ];

  return {
    lookupVersions,
    currentLookupVersion: config.currentLookupVersion,
    seal(plaintext, context) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", current, iv);
      cipher.setAAD(associatedData(context));
      const body = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
      return `${config.currentEncryptionVersion}.${iv.toString("base64url")}.${body.toString("base64url")}`;
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
      const cipher = createCipheriv("aes-256-gcm", current, iv);
      cipher.setAAD(associatedData(context));
      const version = Buffer.from(config.currentEncryptionVersion, "utf8");
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
