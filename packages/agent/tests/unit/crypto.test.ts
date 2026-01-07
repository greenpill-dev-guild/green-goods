import { describe, it, expect, beforeEach } from "vitest";
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
} from "../../src/services/crypto";

describe("Crypto Service", () => {
  const testPrivateKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  describe("encryptPrivateKey / decryptPrivateKey", () => {
    it("should encrypt and decrypt correctly with real crypto", () => {
      const encrypted = encryptPrivateKey(testPrivateKey);
      const decrypted = decryptPrivateKey(encrypted);

      expect(decrypted).toBe(testPrivateKey);
      expect(encrypted.version).toBe(1);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toHaveLength(32); // 16 bytes hex
      expect(encrypted.authTag).toHaveLength(32); // 16 bytes hex
      expect(encrypted.salt).toHaveLength(64); // 32 bytes hex
    });

    it("should produce different ciphertext for same input (unique IV/salt)", () => {
      const encrypted1 = encryptPrivateKey(testPrivateKey);
      const encrypted2 = encryptPrivateKey(testPrivateKey);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it("should fail decryption with tampered data", () => {
      const encrypted = encryptPrivateKey(testPrivateKey);

      // Tamper with ciphertext
      const tampered = {
        ...encrypted,
        ciphertext: "0000" + encrypted.ciphertext.slice(4),
      };

      expect(() => decryptPrivateKey(tampered)).toThrow("Decryption failed");
    });

    it("should fail with incorrect auth tag", () => {
      const encrypted = encryptPrivateKey(testPrivateKey);
      const tampered = {
        ...encrypted,
        authTag: "0".repeat(32),
      };

      expect(() => decryptPrivateKey(tampered)).toThrow();
    });

    it("should handle different key lengths", () => {
      const shortKey = "0x" + "a".repeat(32); // 16 bytes
      const longKey = "0x" + "b".repeat(128); // 64 bytes

      const encryptedShort = encryptPrivateKey(shortKey);
      const encryptedLong = encryptPrivateKey(longKey);

      expect(decryptPrivateKey(encryptedShort)).toBe(shortKey);
      expect(decryptPrivateKey(encryptedLong)).toBe(longKey);
    });
  });

  describe("Key Validation", () => {
    it("should validate Ethereum private keys", () => {
      expect(isValidPrivateKey(testPrivateKey)).toBe(true);
      expect(isValidPrivateKey("0x" + "f".repeat(64))).toBe(true);

      // Invalid cases
      expect(isValidPrivateKey("not-a-key")).toBe(false);
      expect(isValidPrivateKey("0x" + "g".repeat(64))).toBe(false); // Invalid hex
      expect(isValidPrivateKey("0x" + "a".repeat(63))).toBe(false); // Too short
      expect(isValidPrivateKey("0x" + "a".repeat(65))).toBe(false); // Too long
      expect(isValidPrivateKey("a".repeat(64))).toBe(false); // Missing 0x
    });

    it("should validate Ethereum addresses", () => {
      expect(isValidAddress("0x" + "0".repeat(40))).toBe(true);
      expect(isValidAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")).toBe(true);

      // Invalid cases
      expect(isValidAddress("0x" + "0".repeat(39))).toBe(false);
      expect(isValidAddress("0x" + "0".repeat(41))).toBe(false);
      expect(isValidAddress("not-an-address")).toBe(false);
    });
  });

  describe("Key Generation", () => {
    it("should generate cryptographically secure private keys", () => {
      const keys = new Set<string>();

      // Generate 100 keys
      for (let i = 0; i < 100; i++) {
        const key = generateSecurePrivateKey();
        expect(isValidPrivateKey(key)).toBe(true);
        keys.add(key);
      }

      // All should be unique
      expect(keys.size).toBe(100);
    });

    it("should generate secure random IDs", () => {
      const id1 = generateSecureId();
      const id2 = generateSecureId();

      expect(id1).toHaveLength(16); // Default 8 bytes = 16 hex chars
      expect(id2).toHaveLength(16);
      expect(id1).not.toBe(id2);
      expect(/^[a-f0-9]+$/.test(id1)).toBe(true);
    });
  });

  describe("Legacy Key Migration", () => {
    it("should detect encrypted vs plain keys", () => {
      const encrypted = prepareKeyForStorage(testPrivateKey);

      expect(isEncryptedKey(encrypted)).toBe(true);
      expect(isEncryptedKey(testPrivateKey)).toBe(false);
      expect(isEncryptedKey("invalid-json")).toBe(false);
      expect(isEncryptedKey("{}")).toBe(false);
    });

    it("should handle legacy plain keys", () => {
      const result = getPrivateKey(testPrivateKey);

      expect(result.privateKey).toBe(testPrivateKey);
      expect(result.needsMigration).toBe(true);
    });

    it("should handle encrypted keys", () => {
      const encrypted = prepareKeyForStorage(testPrivateKey);
      const result = getPrivateKey(encrypted);

      expect(result.privateKey).toBe(testPrivateKey);
      expect(result.needsMigration).toBe(false);
    });
  });
});
