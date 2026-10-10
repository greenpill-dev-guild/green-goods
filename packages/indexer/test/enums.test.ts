import assert from "node:assert/strict";

import {
  expandDomainMask,
  mapCapitalType,
  mapDomainType,
  mapENSNameType,
  mapPoolType,
  mapWeightScheme,
} from "../src/handlers/enums";

describe("mapDomainType", () => {
  it("maps 0 to SOLAR", () => assert.equal(mapDomainType(0n), "SOLAR"));
  it("maps 1 to AGRO", () => assert.equal(mapDomainType(1n), "AGRO"));
  it("maps 2 to EDU", () => assert.equal(mapDomainType(2n), "EDU"));
  it("maps 3 to WASTE", () => assert.equal(mapDomainType(3n), "WASTE"));
  it("returns UNKNOWN for unrecognized values", () => assert.equal(mapDomainType(99n), "UNKNOWN"));
});

describe("expandDomainMask", () => {
  it("expands mask 0 to empty array", () => assert.deepEqual(expandDomainMask(0), []));
  it("expands mask 1 to SOLAR", () => assert.deepEqual(expandDomainMask(1), ["SOLAR"]));
  it("expands mask 2 to AGRO", () => assert.deepEqual(expandDomainMask(2), ["AGRO"]));
  it("expands mask 4 to EDU", () => assert.deepEqual(expandDomainMask(4), ["EDU"]));
  it("expands mask 8 to WASTE", () => assert.deepEqual(expandDomainMask(8), ["WASTE"]));
  it("expands mask 0x0F to all domains", () =>
    assert.deepEqual(expandDomainMask(0x0f), ["SOLAR", "AGRO", "EDU", "WASTE"]));
  it("expands mask 0x09 to SOLAR and WASTE", () =>
    assert.deepEqual(expandDomainMask(0x09), ["SOLAR", "WASTE"]));
  it("expands mask 0x06 to AGRO and EDU", () =>
    assert.deepEqual(expandDomainMask(0x06), ["AGRO", "EDU"]));
});

describe("mapCapitalType", () => {
  it("maps all 8 capital types", () => {
    assert.equal(mapCapitalType(0n), "SOCIAL");
    assert.equal(mapCapitalType(1n), "MATERIAL");
    assert.equal(mapCapitalType(2n), "FINANCIAL");
    assert.equal(mapCapitalType(3n), "LIVING");
    assert.equal(mapCapitalType(4n), "INTELLECTUAL");
    assert.equal(mapCapitalType(5n), "EXPERIENTIAL");
    assert.equal(mapCapitalType(6n), "SPIRITUAL");
    assert.equal(mapCapitalType(7n), "CULTURAL");
  });

  it("returns UNKNOWN for unrecognized values", () => {
    assert.equal(mapCapitalType(99n), "UNKNOWN");
  });
});

describe("enum mappers", () => {
  it("mapWeightScheme maps known values", () => {
    assert.equal(mapWeightScheme(0n), "LINEAR");
    assert.equal(mapWeightScheme(1n), "EXPONENTIAL");
    assert.equal(mapWeightScheme(2n), "POWER");
  });

  it("mapWeightScheme defaults to LINEAR for unknown", () => {
    assert.equal(mapWeightScheme(99n), "LINEAR");
  });

  it("mapPoolType maps known values", () => {
    assert.equal(mapPoolType(0n), "HYPERCERT");
    assert.equal(mapPoolType(1n), "ACTION");
  });

  it("mapPoolType defaults to HYPERCERT for unknown", () => {
    assert.equal(mapPoolType(99n), "HYPERCERT");
  });

  it("mapENSNameType maps known values", () => {
    assert.equal(mapENSNameType(0n), "Gardener");
    assert.equal(mapENSNameType(1n), "Garden");
  });

  it("mapENSNameType defaults to Gardener for unknown", () => {
    assert.equal(mapENSNameType(99n), "Gardener");
  });
});
