/**
 * Cryptographic Service Tests
 *
 * Tests for encryption, key generation, and validation functions.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";

import {
  encryptPrivateKey,
  decryptPrivateKey,
  isEncryptedKey,
  getPrivateKey,
  prepareKeyForStorage,
  generateSecurePrivateKey,
  generateSecureId,
  isValidPrivateKey,
  isValidAddress,
  type EncryptedData,
} from "../services/crypto";

// Set up encryption secret for tests
const originalSecret = process.env.ENCRYPTION_SECRET;
const originalToken = process.env.TELEGRAM_BOT_TOKEN;

beforeAll(() => {
  process.env.ENCRYPTION_SECRET = "test-secret-key-for-encryption-32chars!";
  process.env.TELEGRAM_BOT_TOKEN = "test-token-for-fallback";
});

afterAll(() => {
  if (originalSecret) {
    process.env.ENCRYPTION_SECRET = originalSecret;
  } else {
    delete process.env.ENCRYPTION_SECRET;
  }
  if (originalToken) {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
  } else {
    delete process.env.TELEGRAM_BOT_TOKEN;
  }
});

describe("encryptPrivateKey / decryptPrivateKey", () => {
  const testKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  it("encrypts and decrypts a private key correctly", () => {
    const encrypted = encryptPrivateKey(testKey);
    const decrypted = decryptPrivateKey(encrypted);

    expect(decrypted).toBe(testKey);
  });

  it("produces different ciphertext each time (unique IV)", () => {
    const encrypted1 = encryptPrivateKey(testKey);
    const encrypted2 = encryptPrivateKey(testKey);

    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.salt).not.toBe(encrypted2.salt);
  });

  it("includes version number in encrypted data", () => {
    const encrypted = encryptPrivateKey(testKey);
    expect(encrypted.version).toBe(1);
  });

  it("includes all required fields", () => {
    const encrypted = encryptPrivateKey(testKey);

    expect(encrypted).toHaveProperty("ciphertext");
    expect(encrypted).toHaveProperty("iv");
    expect(encrypted).toHaveProperty("authTag");
    expect(encrypted).toHaveProperty("salt");
    expect(encrypted).toHaveProperty("version");
  });

  it("throws error on tampered ciphertext", () => {
    const encrypted = encryptPrivateKey(testKey);
    encrypted.ciphertext = "0000" + encrypted.ciphertext.slice(4);

    expect(() => decryptPrivateKey(encrypted)).toThrow("Decryption failed");
  });

  it("throws error on tampered auth tag", () => {
    const encrypted = encryptPrivateKey(testKey);
    encrypted.authTag = "0000" + encrypted.authTag.slice(4);

    expect(() => decryptPrivateKey(encrypted)).toThrow("Decryption failed");
  });
});

describe("isEncryptedKey", () => {
  it("returns true for valid encrypted data JSON", () => {
    const encrypted = encryptPrivateKey("0x1234");
    const json = JSON.stringify(encrypted);

    expect(isEncryptedKey(json)).toBe(true);
  });

  it("returns false for plain private key", () => {
    const plainKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    expect(isEncryptedKey(plainKey)).toBe(false);
  });

  it("returns false for invalid JSON", () => {
    expect(isEncryptedKey("not json")).toBe(false);
  });

  it("returns false for JSON missing required fields", () => {
    expect(isEncryptedKey(JSON.stringify({ foo: "bar" }))).toBe(false);
    expect(isEncryptedKey(JSON.stringify({ version: 1 }))).toBe(false);
  });
});

describe("getPrivateKey", () => {
  it("decrypts encrypted key and returns needsMigration: false", () => {
    const original = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const encrypted = prepareKeyForStorage(original);

    const result = getPrivateKey(encrypted);

    expect(result.privateKey).toBe(original);
    expect(result.needsMigration).toBe(false);
  });

  it("returns plain key and needsMigration: true for legacy keys", () => {
    const legacyKey = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    const result = getPrivateKey(legacyKey);

    expect(result.privateKey).toBe(legacyKey);
    expect(result.needsMigration).toBe(true);
  });
});

describe("prepareKeyForStorage", () => {
  it("returns JSON string of encrypted data", () => {
    const key = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const prepared = prepareKeyForStorage(key);

    expect(() => JSON.parse(prepared)).not.toThrow();

    const parsed = JSON.parse(prepared) as EncryptedData;
    expect(parsed.version).toBe(1);
    expect(parsed.ciphertext).toBeDefined();
  });
});

describe("generateSecurePrivateKey", () => {
  it("generates a valid 32-byte hex key with 0x prefix", () => {
    const key = generateSecurePrivateKey();

    expect(key).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("generates different keys each time", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(generateSecurePrivateKey());
    }
    expect(keys.size).toBe(100);
  });
});

describe("generateSecureId", () => {
  it("generates a hex string of correct length", () => {
    const id = generateSecureId(8);
    expect(id).toMatch(/^[a-f0-9]{16}$/);
  });

  it("uses default length of 8 bytes (16 hex chars)", () => {
    const id = generateSecureId();
    expect(id).toHaveLength(16);
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSecureId());
    }
    expect(ids.size).toBe(100);
  });
});

describe("isValidPrivateKey", () => {
  it("returns true for valid private key", () => {
    expect(
      isValidPrivateKey("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
    ).toBe(true);
  });

  it("returns false for key without 0x prefix", () => {
    expect(
      isValidPrivateKey("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
    ).toBe(false);
  });

  it("returns false for key with wrong length", () => {
    expect(isValidPrivateKey("0x1234")).toBe(false);
    expect(isValidPrivateKey("0x" + "a".repeat(63))).toBe(false);
    expect(isValidPrivateKey("0x" + "a".repeat(65))).toBe(false);
  });

  it("returns false for key with invalid characters", () => {
    expect(
      isValidPrivateKey("0xgggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg")
    ).toBe(false);
  });
});

describe("isValidAddress", () => {
  it("returns true for valid address", () => {
    expect(isValidAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(true);
    expect(isValidAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12")).toBe(true);
  });

  it("returns false for address without 0x prefix", () => {
    expect(isValidAddress("1234567890abcdef1234567890abcdef12345678")).toBe(false);
  });

  it("returns false for address with wrong length", () => {
    expect(isValidAddress("0x1234")).toBe(false);
    expect(isValidAddress("0x" + "a".repeat(39))).toBe(false);
    expect(isValidAddress("0x" + "a".repeat(41))).toBe(false);
  });
});
