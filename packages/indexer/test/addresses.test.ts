import assert from "node:assert/strict";

import { addUniqueAddress, normalizeAddress, removeAddress } from "../src/handlers/addresses";

describe("normalizeAddress", () => {
  it("lowercases an address", () => {
    assert.equal(normalizeAddress("0xAbCdEf"), "0xabcdef");
  });

  it("is idempotent on already-lowercase addresses", () => {
    assert.equal(normalizeAddress("0xabcdef"), "0xabcdef");
  });
});

describe("addUniqueAddress", () => {
  it("adds a new address to an empty list", () => {
    assert.deepEqual(addUniqueAddress([], "0xABC"), ["0xabc"]);
  });

  it("does not add duplicate (case-insensitive)", () => {
    assert.deepEqual(addUniqueAddress(["0xabc"], "0xABC"), ["0xabc"]);
  });

  it("adds a different address", () => {
    assert.deepEqual(addUniqueAddress(["0xabc"], "0xDEF"), ["0xabc", "0xdef"]);
  });

  it("does not mutate the original list", () => {
    const original = ["0xabc"];
    addUniqueAddress(original, "0xdef");
    assert.deepEqual(original, ["0xabc"]);
  });
});

describe("removeAddress", () => {
  it("removes an address (case-insensitive)", () => {
    assert.deepEqual(removeAddress(["0xabc", "0xdef"], "0xABC"), ["0xdef"]);
  });

  it("returns same list when address not found", () => {
    assert.deepEqual(removeAddress(["0xabc"], "0x123"), ["0xabc"]);
  });

  it("returns empty list when removing last element", () => {
    assert.deepEqual(removeAddress(["0xabc"], "0xABC"), []);
  });

  it("does not mutate the original list", () => {
    const original = ["0xabc", "0xdef"];
    removeAddress(original, "0xabc");
    assert.deepEqual(original, ["0xabc", "0xdef"]);
  });
});
