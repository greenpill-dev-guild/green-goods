import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  KARMA_GAP_MODULE_ADDRESS,
  WORK_APPROVAL_RESOLVER_ADDRESS,
  validateKarmaGapBoundary,
  validatePinnedPoolingContracts,
} from "./indexing-boundary-rules.mjs";

const MODULE = "0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a";
const REGISTRY = "0x66300dA4d3749bFc9F7326DB94e0DEb47A7a3959";
const SETTLEMENT = "0x15c8F6CF25abA2161cc04719b4C4a93c4146935D";
const CREDIT = "0xcfF1fdC12Bf130897dB0C9c74fB094C956196A34";
const CELO_EXECUTOR = "0xB8a7F3c3DfA407c45e05b7B2381233101938a84F";

function arbitrumContracts() {
  return [
    { name: "KarmaGAPModule", address: KARMA_GAP_MODULE_ADDRESS },
    { name: "WorkApprovalResolver", address: WORK_APPROVAL_RESOLVER_ADDRESS },
    { name: "CommitmentPoolingModule", address: MODULE },
    { name: "CommitmentRegistry", address: REGISTRY },
    { name: "SettlementModule", address: SETTLEMENT },
    { name: "CreditRegistry", address: CREDIT },
  ];
}

function productionChains() {
  return [
    { id: 42161, start_block: 433_713_812, contracts: arbitrumContracts() },
    {
      id: 42220,
      start_block: 74_691_430,
      contracts: [{ name: "CeloSettlementExecutor", address: CELO_EXECUTOR }],
    },
  ];
}

describe("indexing boundary rules", () => {
  it("pins Karma events to the deployed Arbitrum module only", () => {
    assert.deepEqual(validateKarmaGapBoundary(productionChains()), []);

    const missing = productionChains();
    missing[0].contracts = missing[0].contracts.filter(
      (contract) => contract.name !== "KarmaGAPModule"
    );
    assert.deepEqual(validateKarmaGapBoundary(missing), [
      "Chain 42161 is missing pinned KarmaGAPModule",
    ]);

    const wrong = productionChains();
    wrong[0].contracts = wrong[0].contracts.map((contract) =>
      contract.name === "KarmaGAPModule"
        ? { ...contract, address: "0x9999999999999999999999999999999999999999" }
        : contract
    );
    assert.match(validateKarmaGapBoundary(wrong)[0] ?? "", /address changed/);

    const missingResolver = productionChains();
    missingResolver[0].contracts = missingResolver[0].contracts.filter(
      (contract) => contract.name !== "WorkApprovalResolver"
    );
    assert.ok(
      validateKarmaGapBoundary(missingResolver).includes(
        "Chain 42161 is missing pinned WorkApprovalResolver"
      )
    );

    const wrongResolver = productionChains();
    wrongResolver[0].contracts = wrongResolver[0].contracts.map((contract) =>
      contract.name === "WorkApprovalResolver"
        ? { ...contract, address: "0x9999999999999999999999999999999999999999" }
        : contract
    );
    assert.ok(
      validateKarmaGapBoundary(wrongResolver).some((error) =>
        error.includes("WorkApprovalResolver address changed")
      )
    );

    const sepolia = productionChains();
    sepolia.push({
      id: 11155111,
      start_block: 10_243_363,
      contracts: [{ name: "KarmaGAPModule", address: KARMA_GAP_MODULE_ADDRESS }],
    });
    assert.ok(
      validateKarmaGapBoundary(sepolia).includes(
        "Chain 11155111 must not register KarmaGAPModule"
      )
    );

    const sepoliaResolver = productionChains();
    sepoliaResolver.push({
      id: 11155111,
      start_block: 10_243_363,
      contracts: [{ name: "WorkApprovalResolver", address: WORK_APPROVAL_RESOLVER_ADDRESS }],
    });
    assert.ok(
      validateKarmaGapBoundary(sepoliaResolver).includes(
        "Chain 11155111 must not register WorkApprovalResolver"
      )
    );
  });

  it("accepts the canonical production release pins case-insensitively", () => {
    assert.deepEqual(
      validatePinnedPoolingContracts(productionChains()),
      []
    );
  });

  it("rejects every missing release contract pin", () => {
    for (const [chainId, name] of [
      [42161, "CommitmentPoolingModule"],
      [42161, "CommitmentRegistry"],
      [42161, "SettlementModule"],
      [42161, "CreditRegistry"],
      [42220, "CeloSettlementExecutor"],
    ]) {
      const chains = productionChains().map((chain) =>
        chain.id === chainId
          ? {
              ...chain,
              contracts: chain.contracts.filter((contract) => contract.name !== name),
            }
          : chain
      );

      assert.ok(
        validatePinnedPoolingContracts(chains).includes(
          `Chain ${chainId} is missing pinned ${name}`
        )
      );
    }
  });

  it("rejects a start boundary after any release contract deployment", () => {
    for (const [chainId, startBlock, contractName, deploymentBlock] of [
      [42161, 493_971_795, "CreditRegistry", 493_971_794],
      [42220, 74_691_431, "CeloSettlementExecutor", 74_691_430],
    ]) {
      const chains = productionChains().map((chain) =>
        chain.id === chainId ? { ...chain, start_block: startBlock } : chain
      );

      assert.ok(
        validatePinnedPoolingContracts(chains).includes(
          `Chain ${chainId} start_block must be at or before ${contractName} deployment block ${deploymentBlock}, found ${startBlock}`
        )
      );
    }
  });

  it("rejects duplicate release contract entries", () => {
    for (const [chainId, name] of [
      [42161, "CommitmentPoolingModule"],
      [42161, "CommitmentRegistry"],
      [42161, "SettlementModule"],
      [42161, "CreditRegistry"],
      [42220, "CeloSettlementExecutor"],
    ]) {
      const chains = productionChains();
      const chain = chains.find((candidate) => candidate.id === chainId);
      const contract = chain.contracts.find((candidate) => candidate.name === name);
      chain.contracts.push({ ...contract });

      assert.ok(
        validatePinnedPoolingContracts(chains).includes(
          `Chain ${chainId} contains duplicate ${name} entries`
        )
      );
    }
  });

  it("rejects replacement addresses for every release contract", () => {
    for (const [chainId, name] of [
      [42161, "CommitmentPoolingModule"],
      [42161, "CommitmentRegistry"],
      [42161, "SettlementModule"],
      [42161, "CreditRegistry"],
      [42220, "CeloSettlementExecutor"],
    ]) {
      const chains = productionChains().map((chain) =>
        chain.id === chainId
          ? {
              ...chain,
              contracts: chain.contracts.map((contract) =>
                contract.name === name
                  ? { ...contract, address: "0x9999999999999999999999999999999999999999" }
                  : contract
              ),
            }
          : chain
      );
      const errors = validatePinnedPoolingContracts(chains);

      assert.ok(errors.some((error) => error.includes(`Chain ${chainId} ${name} address changed`)));
    }
  });
});
