import assert from "node:assert/strict";

import {
  getCookieJarId,
  getGardenCommunityId,
  getGardenSignalPoolId,
  getGardenVaultId,
  getGardenVaultIndexId,
  getMarketplaceOrderId,
  getMarketplacePurchaseId,
  getVaultAddressIndexId,
  getVaultDepositId,
  getVaultEventId,
  getYieldAccumulationId,
  getYieldAllocationId,
  getYieldEventId,
  getYieldFractionPurchaseId,
} from "../src/handlers/ids";

describe("ID helpers", () => {
  const CHAIN = 42161;
  const GARDEN = "0xGardenAddr";
  const ASSET = "0xAssetAddr";

  it("getGardenVaultId normalizes addresses", () => {
    assert.equal(
      getGardenVaultId(CHAIN, GARDEN, ASSET),
      `${CHAIN}-${GARDEN.toLowerCase()}-${ASSET.toLowerCase()}`
    );
  });

  it("getGardenVaultIndexId normalizes garden", () => {
    assert.equal(getGardenVaultIndexId(CHAIN, GARDEN), `${CHAIN}-${GARDEN.toLowerCase()}`);
  });

  it("getVaultDepositId normalizes vault and depositor", () => {
    assert.equal(
      getVaultDepositId(CHAIN, "0xVAULT", "0xDEPOSITOR"),
      `${CHAIN}-0xvault-0xdepositor`
    );
  });

  it("getVaultAddressIndexId normalizes vault", () => {
    assert.equal(getVaultAddressIndexId(CHAIN, "0xVAULT"), `${CHAIN}-0xvault`);
  });

  it("getVaultEventId uses txHash and logIndex", () => {
    assert.equal(getVaultEventId(CHAIN, "0xTX", 5), `${CHAIN}-0xTX-5`);
  });

  it("getVaultEventId handles bigint logIndex", () => {
    assert.equal(getVaultEventId(CHAIN, "0xTX", 5n), `${CHAIN}-0xTX-5`);
  });

  it("getYieldAllocationId uses txHash and logIndex", () => {
    assert.equal(getYieldAllocationId(CHAIN, "0xTX", 3), `${CHAIN}-0xTX-3`);
  });

  it("getYieldAccumulationId normalizes addresses", () => {
    assert.equal(
      getYieldAccumulationId(CHAIN, GARDEN, ASSET),
      `${CHAIN}-${GARDEN.toLowerCase()}-${ASSET.toLowerCase()}`
    );
  });

  it("getYieldFractionPurchaseId includes hypercertId", () => {
    assert.equal(getYieldFractionPurchaseId(CHAIN, "0xTX", 1, 42n), `${CHAIN}-0xTX-1-42`);
  });

  it("getYieldEventId matches getVaultEventId format", () => {
    assert.equal(getYieldEventId(CHAIN, "0xTX", 7), getVaultEventId(CHAIN, "0xTX", 7));
  });

  it("getCookieJarId normalizes addresses", () => {
    assert.equal(
      getCookieJarId(CHAIN, GARDEN, ASSET),
      `${CHAIN}-${GARDEN.toLowerCase()}-${ASSET.toLowerCase()}`
    );
  });

  it("getGardenCommunityId normalizes garden", () => {
    assert.equal(getGardenCommunityId(CHAIN, GARDEN), `${CHAIN}-${GARDEN.toLowerCase()}`);
  });

  it("getGardenSignalPoolId normalizes addresses", () => {
    assert.equal(
      getGardenSignalPoolId(CHAIN, GARDEN, "0xPOOL"),
      `${CHAIN}-${GARDEN.toLowerCase()}-0xpool`
    );
  });

  it("getMarketplaceOrderId uses orderId", () => {
    assert.equal(getMarketplaceOrderId(CHAIN, 42n), `${CHAIN}-42`);
  });

  it("getMarketplacePurchaseId uses txHash and logIndex", () => {
    assert.equal(getMarketplacePurchaseId(CHAIN, "0xTX", 3), `${CHAIN}-0xTX-3`);
  });
});
