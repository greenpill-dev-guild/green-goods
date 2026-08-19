import { getAddress } from "ethers";
import { describe, expect, it } from "vitest";

import {
  ALLOWANCE_KEY,
  assertNextRolesBoundary,
  buildRolesTransactions,
  buildTransferConditions,
  encodeMultiSend,
  modifierSaltNonce,
  parseArguments,
  permissionsConfigHash,
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

const SAFES = Array.from({ length: 18 }, (_, index) => `0x${(index + 1).toString(16).padStart(40, "0")}`);

describe("G$ transfer permission tree", () => {
  it("allows only the registered Safes, and only within the allowance", () => {
    const conditions = buildTransferConditions(SAFES);

    // One calldata match, one logical Or for the recipient, one allowance check, 18 leaves.
    expect(conditions).toHaveLength(21);
    expect(conditions[0]).toMatchObject({ parent: 0, paramType: 5, operator: 5 });
    // Logical nodes carry no paramType of their own; the leaves hold Static.
    expect(conditions[1]).toMatchObject({ parent: 0, paramType: 0, operator: 2 });
    expect(conditions[2]).toMatchObject({ parent: 0, paramType: 1, operator: 28 });
    expect(conditions[2].compValue).toContain(ALLOWANCE_KEY.slice(2));

    const leaves = conditions.slice(3);
    expect(leaves).toHaveLength(18);
    expect(leaves.every((leaf) => leaf.parent === 1 && leaf.paramType === 1 && leaf.operator === 16)).toBe(true);
    // Every registered Safe appears exactly once as an allowed recipient.
    for (const safe of SAFES) {
      expect(leaves.filter((leaf) => leaf.compValue.toLowerCase().endsWith(safe.slice(2).toLowerCase()))).toHaveLength(
        1,
      );
    }
  });

  it("refuses an allowlist that is not the exact registered set", () => {
    expect(() => buildTransferConditions(SAFES.slice(0, 17))).toThrow(/all 18 registered Garden Safes/);
    expect(() => buildTransferConditions([...SAFES.slice(0, 17), SAFES[0]])).toThrow(/duplicate Safe/);
  });

  it("commits the immutable permission facts and nothing mutable", () => {
    const conditions = buildTransferConditions(SAFES);
    const modifier = "0x679AEB80a481772Df85E2b93F8fDc5180EF422e1";
    const base = permissionsConfigHash(SAFE_A, modifier, conditions);

    expect(base).toMatch(/^0x[0-9a-f]{64}$/u);
    // A different Safe or modifier is a different permission.
    expect(permissionsConfigHash(SAFE_B, modifier, conditions)).not.toEqual(base);
    expect(permissionsConfigHash(SAFE_A, SAFE_B, conditions)).not.toEqual(base);
    // So is any change to the reviewed tree.
    const widened = buildTransferConditions([...SAFES.slice(0, 17), SAFE_B]);
    expect(permissionsConfigHash(SAFE_A, modifier, widened)).not.toEqual(base);
  });
});

describe("EOA configuration boundaries", () => {
  const boundaries = SAFES.map((safe, index) => ({
    tokenId: index,
    garden: safe,
    safe,
    modifier: `0x${(index + 200).toString(16).padStart(40, "0")}`,
    saltNonce: "1",
    initializerHash: `0x${"11".repeat(32)}`,
    enableModuleData: "0x610b5925",
    safeTxHash: `0x${"22".repeat(32)}`,
    safeNonce: 0,
    permissionsConfigHash: `0x${"33".repeat(32)}`,
  }));
  const executor = "0xB8a7F3c3DfA407c45e05b7B2381233101938a84F";

  it("orders six unsigned boundaries per Safe and transfers ownership last", () => {
    const transactions = buildRolesTransactions(boundaries, buildTransferConditions(SAFES), executor);

    expect(transactions).toHaveLength(SAFES.length * 6);
    expect(transactions.map((transaction) => transaction.step)).toEqual(
      Array.from({ length: transactions.length }, (_, index) => index + 1),
    );
    expect(transactions.slice(0, 6).map((transaction) => transaction.kind)).toEqual([
      "DEPLOY_MODIFIER",
      "SCOPE_TARGET",
      "SCOPE_FUNCTION",
      "SET_ALLOWANCE",
      "ASSIGN_EXECUTOR",
      "TRANSFER_OWNERSHIP",
    ]);
    // Ownership must leave the operator only after the role is fully scoped.
    for (let safeIndex = 0; safeIndex < SAFES.length; safeIndex += 1) {
      const perSafe = transactions.slice(safeIndex * 6, safeIndex * 6 + 6);
      expect(perSafe.every((transaction) => transaction.safe === boundaries[safeIndex].safe)).toBe(true);
      expect(perSafe.at(-1)?.kind).toBe("TRANSFER_OWNERSHIP");
    }
  });

  it("moves no value and touches only the factory or that Safe's own modifier", () => {
    const transactions = buildRolesTransactions(boundaries, buildTransferConditions(SAFES), executor);

    expect(transactions.every((transaction) => transaction.value === "0")).toBe(true);
    for (const transaction of transactions) {
      const expected =
        transaction.kind === "DEPLOY_MODIFIER" ? "0x000000000000aDdB49795b0f9bA5BC298cDda236" : transaction.modifier;
      expect(transaction.to.toLowerCase()).toEqual(expected.toLowerCase());
    }
  });
});

describe("Roles execution boundaries", () => {
  it("binds every broadcast to one explicit boundary", () => {
    expect(parseArguments(["plan"]).broadcast).toBe(false);
    expect(parseArguments(["deploy", "--broadcast", "--step", "7"])).toMatchObject({
      command: "deploy",
      broadcast: true,
      step: 7,
    });

    expect(() => parseArguments(["deploy", "--step", "1"])).toThrow(/requires --broadcast/);
    expect(() => parseArguments(["deploy", "--broadcast"])).toThrow(/one explicit --step boundary/);
    expect(() => parseArguments(["plan", "--broadcast"])).toThrow(/does not accept --broadcast/);
    expect(() => parseArguments(["plan", "--step", "1"])).toThrow(/does not accept --broadcast or --step/);
    expect(() => parseArguments(["deploy", "--broadcast", "--step", "0"])).toThrow(/positive boundary index/);
    expect(() => parseArguments(["enable"])).toThrow(/plan\|deploy/);
  });

  it("resumes at the first uncheckpointed boundary and refuses to replay or skip", () => {
    expect(assertNextRolesBoundary(1, 0)).toBe(1);
    expect(assertNextRolesBoundary(108, 107)).toBe(108);
    // Replaying a mined boundary and jumping over an unmined one both fail closed.
    expect(() => assertNextRolesBoundary(50, 50)).toThrow(/next uncheckpointed boundary 51/);
    expect(() => assertNextRolesBoundary(52, 50)).toThrow(/next uncheckpointed boundary 51/);
  });
});
