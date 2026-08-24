import assert from "node:assert/strict";

import {
  CAPITAL_TYPE_MAP,
  DOMAIN_TYPE_MAP,
  GARDEN_ROLE,
  ZERO_ADDRESS,
} from "../src/handlers/constants";

describe("constants", () => {
  it("CAPITAL_TYPE_MAP has 8 entries", () => {
    assert.equal(Object.keys(CAPITAL_TYPE_MAP).length, 8);
  });

  it("DOMAIN_TYPE_MAP has 4 entries", () => {
    assert.equal(Object.keys(DOMAIN_TYPE_MAP).length, 4);
  });

  it("GARDEN_ROLE maps all 6 roles", () => {
    assert.equal(GARDEN_ROLE.Gardener, 0);
    assert.equal(GARDEN_ROLE.Evaluator, 1);
    assert.equal(GARDEN_ROLE.Operator, 2);
    assert.equal(GARDEN_ROLE.Owner, 3);
    assert.equal(GARDEN_ROLE.Funder, 4);
    assert.equal(GARDEN_ROLE.Community, 5);
  });

  it("ZERO_ADDRESS is 40 hex zeros", () => {
    assert.equal(ZERO_ADDRESS, "0x0000000000000000000000000000000000000000");
    assert.equal(ZERO_ADDRESS.length, 42);
  });
});
