import assert from "node:assert/strict";

import {
  createDefaultGarden,
  createDefaultGardenVault,
  createDefaultHypercert,
} from "../src/handlers/entity-defaults";

describe("createDefaultGarden", () => {
  it("creates a garden with empty defaults", () => {
    const garden = createDefaultGarden("0xgarden", 42161, 1000);

    assert.equal(garden.id, "0xgarden");
    assert.equal(garden.chainId, 42161);
    assert.equal(garden.tokenAddress, "");
    assert.equal(garden.tokenID, 0n);
    assert.equal(garden.name, "");
    assert.equal(garden.description, "");
    assert.equal(garden.location, "");
    assert.equal(garden.bannerImage, "");
    assert.equal(garden.openJoining, false);
    assert.equal(garden.initialized, false);
    assert.deepEqual(garden.gardeners, []);
    assert.deepEqual(garden.operators, []);
    assert.deepEqual(garden.evaluators, []);
    assert.deepEqual(garden.owners, []);
    assert.deepEqual(garden.funders, []);
    assert.deepEqual(garden.communities, []);
    assert.equal(garden.createdAt, 1000);
    assert.equal(garden.gapProjectUID, undefined);
  });
});

describe("createDefaultGardenVault", () => {
  it("creates a vault with correct defaults", () => {
    const vault = createDefaultGardenVault(42161, "0xGarden", "0xAsset", "0xVault", 1000);

    assert.equal(vault.chainId, 42161);
    assert.equal(vault.garden, "0xgarden");
    assert.equal(vault.asset, "0xasset");
    assert.equal(vault.vaultAddress, "0xvault");
    assert.equal(vault.totalDeposited, 0n);
    assert.equal(vault.totalWithdrawn, 0n);
    assert.equal(vault.totalHarvestCount, 0);
    assert.equal(vault.donationAddress, undefined);
    assert.equal(vault.depositorCount, 0);
    assert.equal(vault.paused, false);
    assert.equal(vault.createdAt, 1000);
  });

  it("normalizes addresses", () => {
    const vault = createDefaultGardenVault(1, "0xABC", "0xDEF", "0xGHI", 0);
    assert.equal(vault.garden, "0xabc");
    assert.equal(vault.asset, "0xdef");
    assert.equal(vault.vaultAddress, "0xghi");
  });
});

describe("createDefaultHypercert", () => {
  it("creates a hypercert with correct defaults", () => {
    const hc = createDefaultHypercert("42161-999", 42161, 999n, 5000);

    assert.equal(hc.id, "42161-999");
    assert.equal(hc.chainId, 42161);
    assert.equal(hc.tokenId, 999n);
    assert.equal(hc.garden, "");
    assert.equal(hc.metadataUri, "");
    assert.equal(hc.mintedAt, 5000);
    assert.equal(hc.mintedBy, "");
    assert.equal(hc.txHash, "");
    assert.equal(hc.totalUnits, 0n);
    assert.equal(hc.claimedUnits, 0n);
    assert.equal(hc.attestationCount, 0);
    assert.deepEqual(hc.attestationUIDs, []);
    assert.equal(hc.status, "ACTIVE");
    assert.equal(hc.createdAt, 5000);
    assert.equal(hc.updatedAt, 5000);
  });
});
