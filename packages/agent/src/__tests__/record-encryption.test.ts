import { describe, expect, it } from "vitest";
import { createGardenJoinRequestCipher } from "../services/garden-join-requests";
import { createSavedOfferCipher } from "../services/saved-offers";

const plaintext = '{"note":"regenerative work 🌱"}';
const nonce = "AAECAwQFBgcICQoL";

// Fixed records in the pre-extraction format: base64(ciphertext || 16-byte tag),
// with a separate base64 12-byte nonce. Keys here are disposable test values.
const cases = [
  {
    feature: "garden joins",
    create: createGardenJoinRequestCipher,
    key: "ab".repeat(32),
    ciphertext: "W3loMTpyR2JmXTzuHPRL0MSXHD27VQ782C7rbv5LvIZfIUL2gn2XP5oYJ2yuPWwydQ==",
    invalidKey: "JOIN_REQUESTS_ENCRYPTION_KEY must be 32 bytes encoded as hex or base64",
    invalidRecord: "Invalid garden join request ciphertext",
  },
  {
    feature: "saved offers",
    create: createSavedOfferCipher,
    key: "cd".repeat(32),
    ciphertext: "y5++DYI7jsgTQnckwfGuGODcNieD3rIhqo2ggsPzKadCXCmamSzuPKZLKO0BxGrRQw==",
    invalidKey: "SAVED_OFFERS_ENCRYPTION_KEY must be 32 bytes encoded as hex or base64",
    invalidRecord: "Invalid Saved Offer ciphertext",
  },
];

describe.each(cases)("$feature record encryption compatibility", (fixture) => {
  it("reads existing ciphertext with hex and padded or unpadded base64 keys", () => {
    const base64 = Buffer.from(fixture.key, "hex").toString("base64");
    for (const secret of [
      fixture.key,
      fixture.key.toUpperCase(),
      base64,
      base64.replace(/=+$/, ""),
    ]) {
      expect(fixture.create(secret).decrypt({ ciphertext: fixture.ciphertext, nonce })).toBe(
        plaintext
      );
    }
  });

  it("keeps fresh nonces and the existing authenticated envelope for new records", () => {
    const cipher = fixture.create(fixture.key);
    const first = cipher.encrypt(plaintext);
    const second = cipher.encrypt(plaintext);
    expect(first.nonce).not.toBe(second.nonce);
    expect(Buffer.from(first.nonce, "base64")).toHaveLength(12);
    expect(Buffer.from(first.ciphertext, "base64")).toHaveLength(Buffer.byteLength(plaintext) + 16);
    expect(cipher.decrypt(first)).toBe(plaintext);
    expect(cipher.decrypt(second)).toBe(plaintext);
  });

  it("rejects changed ciphertext, tags, nonces, and the other feature's key", () => {
    const cipher = fixture.create(fixture.key);
    const record = { ciphertext: fixture.ciphertext, nonce };
    for (const offset of [0, Buffer.from(record.ciphertext, "base64").length - 1]) {
      const altered = Buffer.from(record.ciphertext, "base64");
      altered[offset] ^= 1;
      expect(() => cipher.decrypt({ ...record, ciphertext: altered.toString("base64") })).toThrow();
    }
    expect(() =>
      cipher.decrypt({ ...record, nonce: Buffer.alloc(12, 1).toString("base64") })
    ).toThrow();
    const other = cases.find((entry) => entry.feature !== fixture.feature)!;
    expect(() => other.create(other.key).decrypt(record)).toThrow();
  });

  it("preserves key rejection and feature-specific configuration errors", () => {
    const base64 = Buffer.from(fixture.key, "hex").toString("base64");
    for (const secret of ["", "ab".repeat(31), "ab".repeat(33), `${base64}\n`, `!${base64}`]) {
      expect(() => fixture.create(secret)).toThrow(fixture.invalidKey);
    }
  });

  it("preserves short-envelope rejection, including a tag without ciphertext", () => {
    const cipher = fixture.create(fixture.key);
    for (const size of [0, 15, 16]) {
      expect(() =>
        cipher.decrypt({ ciphertext: Buffer.alloc(size).toString("base64"), nonce })
      ).toThrow(fixture.invalidRecord);
    }
  });
});

it("preserves join-request HMAC indexes, prefixes, and case normalization", () => {
  const cipher = createGardenJoinRequestCipher("ab".repeat(32));
  expect(cipher.accountKey("0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD")).toBe(
    "0fc2d70a09bd31284c8311e3e4d4242567de8e08ba971b61e49d48aab12b7f0d"
  );
  expect(cipher.proofKey("NONCE-ABC")).toBe(
    "fd728c056ab718b01702ce910af45fe58f7d8d35695f09bf0347f7f850b0cb06"
  );
});
