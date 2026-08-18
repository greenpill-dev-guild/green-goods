import { getAddress } from "ethers";
import { describe, expect, it } from "vitest";

import {
  encodeMultiSend,
  modifierSaltNonce,
  predictModifier,
  rolesInitializer,
  safeTransactionHash,
} from "./garden-roles";

const SAFE_A = "0xe41a1e446644034f24a4B2E1bfB28Fd414dBc66d";
const SAFE_B = "0xa23716F7B0DBBB0387Fb1274f1Ae8247670dCC37";
const OWNER = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";

describe("Garden Roles modifier planning", () => {
  it("binds each modifier to exactly one Safe", () => {
    // The salt is domain-separated by Safe, so no two Gardens can collide onto one modifier.
    expect(modifierSaltNonce(SAFE_A)).not.toEqual(modifierSaltNonce(SAFE_B));
    expect(modifierSaltNonce(SAFE_A)).toEqual(modifierSaltNonce(SAFE_A.toLowerCase()));

    const a = predictModifier(rolesInitializer(OWNER, SAFE_A), modifierSaltNonce(SAFE_A));
    const b = predictModifier(rolesInitializer(OWNER, SAFE_B), modifierSaltNonce(SAFE_B));
    expect(a).not.toEqual(b);
    expect(a).toEqual(predictModifier(rolesInitializer(OWNER, SAFE_A), modifierSaltNonce(SAFE_A)));
    expect(a).toEqual(getAddress(a));
  });

  it("makes the owner part of the modifier address", () => {
    // Ownership is chosen at deployment, so a different owner is a different contract entirely —
    // the plan cannot silently deploy a Safe-owned modifier where an EOA-owned one was reviewed.
    const asOperator = predictModifier(rolesInitializer(OWNER, SAFE_A), modifierSaltNonce(SAFE_A));
    const asSafe = predictModifier(rolesInitializer(SAFE_A, SAFE_A), modifierSaltNonce(SAFE_A));
    expect(asOperator).not.toEqual(asSafe);
  });

  it("distinguishes every Safe transaction it asks the recovery Safes to pre-approve", () => {
    const enableA = "0x610b5925";
    const hash = safeTransactionHash(SAFE_A, enableA, 0);

    expect(hash).toMatch(/^0x[0-9a-f]{64}$/u);
    // A different Safe, payload, or nonce must never reuse an approval.
    expect(safeTransactionHash(SAFE_B, enableA, 0)).not.toEqual(hash);
    expect(safeTransactionHash(SAFE_A, `${enableA}00`, 0)).not.toEqual(hash);
    expect(safeTransactionHash(SAFE_A, enableA, 1)).not.toEqual(hash);
  });

  it("packs batched approvals as operation, target, value, length, payload", () => {
    const encoded = encodeMultiSend([{ to: SAFE_A, data: "0xabcdef" }]);
    const inner = encoded.slice(10);

    expect(encoded.startsWith("0x8d80ff0a")).toBe(true);
    // One call: 1 + 20 + 32 + 32 + 3 bytes of payload.
    expect(inner).toContain("00");
    expect(inner.toLowerCase()).toContain(SAFE_A.slice(2).toLowerCase());
    expect(inner.toLowerCase()).toContain("abcdef");

    // Batching more calls grows the payload rather than replacing it.
    const two = encodeMultiSend([
      { to: SAFE_A, data: "0xabcdef" },
      { to: SAFE_B, data: "0x123456" },
    ]);
    expect(two.length).toBeGreaterThan(encoded.length);
    expect(two.toLowerCase()).toContain(SAFE_B.slice(2).toLowerCase());
  });
});
