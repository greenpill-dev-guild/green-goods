/**
 * Cryptographic utilities for secure key management.
 *
 * This module provides encryption/decryption for sensitive data like private keys.
 * Uses AES-256-GCM with proper key derivation from a master secret.
 *
 * SECURITY NOTES:
 * - The ENCRYPTION_SECRET should be stored securely (env var, KMS, etc.)
 * - Each encrypted value gets a unique IV (initialization vector)
 * - GCM mode provides authentication in addition to encryption
 */

import crypto from "crypto";
import { loggers } from "./logger";

const log = loggers.crypto;

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits for GCM
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits for AES-256
const PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum

// ============================================================================
// TYPES
// ============================================================================

export interface EncryptedData {
  /** Encrypted data as hex string */
  ciphertext: string;
  /** Initialization vector as hex string */
  iv: string;
  /** GCM authentication tag as hex string */
  authTag: string;
  /** Salt used for key derivation as hex string */
  salt: string;
  /** Version for future migration support */
  version: 1;
}

// ============================================================================
// KEY DERIVATION
// ============================================================================

/**
 * Derives an encryption key from the master secret using PBKDF2.
 * Uses a unique salt per encryption for key isolation.
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
}

/**
 * Gets the encryption secret from environment.
 * Generates a warning if using a weak/default secret.
 */
function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    log.warn(
      "ENCRYPTION_SECRET not set - using derived key from TELEGRAM_BOT_TOKEN. Set ENCRYPTION_SECRET for production."
    );
    // Fall back to bot token as secret (better than nothing, but not ideal)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error("Neither ENCRYPTION_SECRET nor TELEGRAM_BOT_TOKEN is set");
    }
    return crypto.createHash("sha256").update(botToken).digest("hex");
  }

  // Warn if secret seems weak
  if (secret.length < 32) {
    log.warn("ENCRYPTION_SECRET should be at least 32 characters");
  }

  return secret;
}

// ============================================================================
// ENCRYPTION / DECRYPTION
// ============================================================================

/**
 * Encrypts a private key or other sensitive data.
 *
 * Uses AES-256-GCM with:
 * - PBKDF2-derived key from master secret
 * - Unique salt per encryption
 * - Random IV per encryption
 * - Authentication tag for integrity
 *
 * @param plaintext - The data to encrypt (e.g., private key)
 * @returns Encrypted data object that can be JSON-serialized
 *
 * @example
 * const encrypted = encryptPrivateKey("0x1234...");
 * // Store JSON.stringify(encrypted) in database
 */
export function encryptPrivateKey(plaintext: string): EncryptedData {
  const secret = getEncryptionSecret();

  // Generate unique salt and IV for this encryption
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from secret + salt
  const key = deriveKey(secret, salt);

  // Create cipher and encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    salt: salt.toString("hex"),
    version: 1,
  };
}

/**
 * Decrypts a previously encrypted private key.
 *
 * @param encrypted - The encrypted data object
 * @returns The original plaintext
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 *
 * @example
 * const encrypted = JSON.parse(storedData);
 * const privateKey = decryptPrivateKey(encrypted);
 */
export function decryptPrivateKey(encrypted: EncryptedData): string {
  const secret = getEncryptionSecret();

  // Parse hex strings back to buffers
  const salt = Buffer.from(encrypted.salt, "hex");
  const iv = Buffer.from(encrypted.iv, "hex");
  const authTag = Buffer.from(encrypted.authTag, "hex");

  // Derive the same key using stored salt
  const key = deriveKey(secret, salt);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  try {
    let plaintext = decipher.update(encrypted.ciphertext, "hex", "utf8");
    plaintext += decipher.final("utf8");
    return plaintext;
  } catch {
    throw new Error("Decryption failed: Invalid key or corrupted data");
  }
}

/**
 * Checks if a string is an encrypted key object (JSON) or raw plaintext.
 * Used for migration from unencrypted to encrypted storage.
 */
export function isEncryptedKey(data: string): boolean {
  try {
    const parsed = JSON.parse(data);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      "ciphertext" in parsed &&
      "iv" in parsed &&
      "authTag" in parsed &&
      "salt" in parsed
    );
  } catch {
    return false;
  }
}

/**
 * Safely gets a private key, handling both encrypted and legacy unencrypted formats.
 * Automatically encrypts and returns the encrypted version for migration.
 *
 * @param storedKey - The key as stored in the database
 * @returns Object with the decrypted key and whether it needs migration
 */
export function getPrivateKey(storedKey: string): {
  privateKey: string;
  needsMigration: boolean;
} {
  if (isEncryptedKey(storedKey)) {
    // Already encrypted - decrypt it
    const encrypted = JSON.parse(storedKey) as EncryptedData;
    return {
      privateKey: decryptPrivateKey(encrypted),
      needsMigration: false,
    };
  }

  // Legacy unencrypted key - return as-is but flag for migration
  log.warn("Found unencrypted private key - will be encrypted on next save");
  return {
    privateKey: storedKey,
    needsMigration: true,
  };
}

/**
 * Prepares a private key for storage (encrypts it).
 *
 * @param privateKey - The raw private key
 * @returns JSON string of encrypted data
 */
export function prepareKeyForStorage(privateKey: string): string {
  const encrypted = encryptPrivateKey(privateKey);
  return JSON.stringify(encrypted);
}

// ============================================================================
// SECURE RANDOM GENERATION
// ============================================================================

/**
 * Generates a cryptographically secure private key.
 *
 * @returns A 32-byte hex private key with 0x prefix
 */
export function generateSecurePrivateKey(): `0x${string}` {
  const randomBytes = crypto.randomBytes(32);
  return `0x${randomBytes.toString("hex")}` as `0x${string}`;
}

/**
 * Generates a secure random ID for pending work, etc.
 *
 * @param length - Number of bytes (default: 8 = 16 hex chars)
 * @returns Hex string ID
 */
export function generateSecureId(length: number = 8): string {
  return crypto.randomBytes(length).toString("hex");
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates that a string looks like an Ethereum private key.
 */
export function isValidPrivateKey(key: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(key);
}

/**
 * Validates that a string looks like an Ethereum address.
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
