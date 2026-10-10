import assert from "node:assert/strict";

import { getTxHash } from "../src/handlers/event-access";

describe("getTxHash", () => {
  it("extracts hash from valid transaction object", () => {
    assert.equal(getTxHash({ hash: "0xabc123" }), "0xabc123");
  });

  it("throws on null transaction", () => {
    assert.throws(() => getTxHash(null), /Invalid transaction object/);
  });

  it("throws on undefined transaction", () => {
    assert.throws(() => getTxHash(undefined), /Invalid transaction object/);
  });

  it("throws when hash is missing", () => {
    assert.throws(() => getTxHash({ foo: "bar" }), /Invalid transaction object/);
  });

  it("throws when hash is not a string", () => {
    assert.throws(() => getTxHash({ hash: 123 }), /Invalid transaction object/);
  });

  it("throws on non-object values", () => {
    assert.throws(() => getTxHash("string"), /Invalid transaction object/);
    assert.throws(() => getTxHash(42), /Invalid transaction object/);
  });
});
