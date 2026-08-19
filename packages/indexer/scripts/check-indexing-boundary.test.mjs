import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validatePinnedPoolingContracts } from "./indexing-boundary-rules.mjs";

const MODULE = "0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a";
const REGISTRY = "0x66300dA4d3749bFc9F7326DB94e0DEb47A7a3959";

function arbitrumContracts() {
  return [
    { name: "CommitmentPoolingModule", address: MODULE },
    { name: "CommitmentRegistry", address: REGISTRY },
  ];
}

describe("indexing boundary pinned pooling contracts", () => {
  it("accepts the canonical Arbitrum pair case-insensitively", () => {
    assert.deepEqual(
      validatePinnedPoolingContracts([{ id: 42161, contracts: arbitrumContracts() }]),
      []
    );
  });

  it("rejects duplicate module and registry entries", () => {
    for (const name of ["CommitmentPoolingModule", "CommitmentRegistry"]) {
      const contracts = arbitrumContracts();
      const contract = contracts.find((candidate) => candidate.name === name);
      contracts.push({ ...contract });

      assert.ok(
        validatePinnedPoolingContracts([{ id: 42161, contracts }]).includes(
          `Chain 42161 contains duplicate ${name} entries`
        )
      );
    }
  });

  it("rejects replacement addresses for both pinned contracts", () => {
    for (const name of ["CommitmentPoolingModule", "CommitmentRegistry"]) {
      const contracts = arbitrumContracts().map((contract) =>
        contract.name === name
          ? { ...contract, address: "0x9999999999999999999999999999999999999999" }
          : contract
      );
      const errors = validatePinnedPoolingContracts([{ id: 42161, contracts }]);

      assert.ok(errors.some((error) => error.includes(`Chain 42161 ${name} address changed`)));
    }
  });
});
