import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedRecordCipher = {
  encrypt(plaintext: string): { ciphertext: string; nonce: string };
  decrypt(encrypted: { ciphertext: string; nonce: string }): string;
};

/** Raw 32-byte feature key; independent of the wallet-key derivation in crypto.ts. */
export function parseRecordEncryptionKey(secret: string, keyName: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, "hex");
  const decoded = Buffer.from(secret, "base64");
  if (
    decoded.length === 32 &&
    decoded.toString("base64").replace(/=+$/, "") === secret.replace(/=+$/, "")
  ) {
    return decoded;
  }
  throw new Error(`${keyName} must be 32 bytes encoded as hex or base64`);
}

/** Persisted envelope: base64(ciphertext || 16-byte tag), separate base64 12-byte nonce. */
export function createEncryptedRecordCipher(
  key: Buffer,
  invalidCiphertextMessage: string
): EncryptedRecordCipher {
  return {
    encrypt(plaintext) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return {
        ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64"),
        nonce: nonce.toString("base64"),
      };
    },
    decrypt({ ciphertext, nonce }) {
      const combined = Buffer.from(ciphertext, "base64");
      if (combined.length < 17) throw new Error(invalidCiphertextMessage);
      const encrypted = combined.subarray(0, -16);
      const authTag = combined.subarray(-16);
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64"));
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    },
  };
}
