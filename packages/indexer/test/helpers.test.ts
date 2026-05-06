import assert from "assert";

import {
  getTxHash,
  mapDomainType,
  expandDomainMask,
  mapCapitalType,
  normalizeAddress,
  addUniqueAddress,
  removeAddress,
  createDefaultGarden,
  getGardenVaultId,
  getGardenVaultIndexId,
  getVaultDepositId,
  getVaultAddressIndexId,
  getVaultEventId,
  getYieldAllocationId,
  getYieldAccumulationId,
  getYieldFractionPurchaseId,
  getYieldEventId,
  getCookieJarId,
  getGardenCommunityId,
  getGardenSignalPoolId,
  getMarketplaceOrderId,
  getMarketplacePurchaseId,
  mapWeightScheme,
  mapPoolType,
  mapENSNameType,
  resolveIpfsUri,
  isRecord,
  getString,
  getStringArray,
  parseHypercertMetadata,
  createDefaultGardenVault,
  createDefaultHypercert,
  CAPITAL_TYPE_MAP,
  DOMAIN_TYPE_MAP,
  GARDEN_ROLE,
  ZERO_ADDRESS,
  DEFAULT_IPFS_GATEWAY,
} from "../src/handlers/shared";

// ============================================================================
// getTxHash
// ============================================================================

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

// ============================================================================
// mapDomainType
// ============================================================================

describe("mapDomainType", () => {
  it("maps 0 to SOLAR", () => {
    assert.equal(mapDomainType(0n), "SOLAR");
  });

  it("maps 1 to AGRO", () => {
    assert.equal(mapDomainType(1n), "AGRO");
  });

  it("maps 2 to EDU", () => {
    assert.equal(mapDomainType(2n), "EDU");
  });

  it("maps 3 to WASTE", () => {
    assert.equal(mapDomainType(3n), "WASTE");
  });

  it("returns UNKNOWN for unrecognized values", () => {
    assert.equal(mapDomainType(99n), "UNKNOWN");
  });
});

// ============================================================================
// expandDomainMask
// ============================================================================

describe("expandDomainMask", () => {
  it("expands mask 0 to empty array", () => {
    assert.deepEqual(expandDomainMask(0), []);
  });

  it("expands mask 1 to SOLAR", () => {
    assert.deepEqual(expandDomainMask(1), ["SOLAR"]);
  });

  it("expands mask 2 to AGRO", () => {
    assert.deepEqual(expandDomainMask(2), ["AGRO"]);
  });

  it("expands mask 4 to EDU", () => {
    assert.deepEqual(expandDomainMask(4), ["EDU"]);
  });

  it("expands mask 8 to WASTE", () => {
    assert.deepEqual(expandDomainMask(8), ["WASTE"]);
  });

  it("expands mask 0x0F to all domains", () => {
    assert.deepEqual(expandDomainMask(0x0f), ["SOLAR", "AGRO", "EDU", "WASTE"]);
  });

  it("expands mask 0x09 to SOLAR and WASTE", () => {
    assert.deepEqual(expandDomainMask(0x09), ["SOLAR", "WASTE"]);
  });

  it("expands mask 0x06 to AGRO and EDU", () => {
    assert.deepEqual(expandDomainMask(0x06), ["AGRO", "EDU"]);
  });
});

// ============================================================================
// mapCapitalType
// ============================================================================

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

// ============================================================================
// normalizeAddress / addUniqueAddress / removeAddress
// ============================================================================

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
    const result = addUniqueAddress([], "0xABC");
    assert.deepEqual(result, ["0xabc"]);
  });

  it("does not add duplicate (case-insensitive)", () => {
    const result = addUniqueAddress(["0xabc"], "0xABC");
    assert.deepEqual(result, ["0xabc"]);
  });

  it("adds a different address", () => {
    const result = addUniqueAddress(["0xabc"], "0xDEF");
    assert.deepEqual(result, ["0xabc", "0xdef"]);
  });

  it("does not mutate the original list", () => {
    const original = ["0xabc"];
    addUniqueAddress(original, "0xdef");
    assert.deepEqual(original, ["0xabc"]);
  });
});

describe("removeAddress", () => {
  it("removes an address (case-insensitive)", () => {
    const result = removeAddress(["0xabc", "0xdef"], "0xABC");
    assert.deepEqual(result, ["0xdef"]);
  });

  it("returns same list when address not found", () => {
    const result = removeAddress(["0xabc"], "0x123");
    assert.deepEqual(result, ["0xabc"]);
  });

  it("returns empty list when removing last element", () => {
    const result = removeAddress(["0xabc"], "0xABC");
    assert.deepEqual(result, []);
  });

  it("does not mutate the original list", () => {
    const original = ["0xabc", "0xdef"];
    removeAddress(original, "0xabc");
    assert.deepEqual(original, ["0xabc", "0xdef"]);
  });
});

// ============================================================================
// createDefaultGarden
// ============================================================================

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

// ============================================================================
// ID helper functions
// ============================================================================

describe("ID helpers", () => {
  const CHAIN = 42161;
  const GARDEN = "0xGardenAddr";
  const ASSET = "0xAssetAddr";

  it("getGardenVaultId normalizes addresses", () => {
    const id = getGardenVaultId(CHAIN, GARDEN, ASSET);
    assert.equal(id, `${CHAIN}-${GARDEN.toLowerCase()}-${ASSET.toLowerCase()}`);
  });

  it("getGardenVaultIndexId normalizes garden", () => {
    const id = getGardenVaultIndexId(CHAIN, GARDEN);
    assert.equal(id, `${CHAIN}-${GARDEN.toLowerCase()}`);
  });

  it("getVaultDepositId normalizes vault and depositor", () => {
    const id = getVaultDepositId(CHAIN, "0xVAULT", "0xDEPOSITOR");
    assert.equal(id, `${CHAIN}-0xvault-0xdepositor`);
  });

  it("getVaultAddressIndexId normalizes vault", () => {
    const id = getVaultAddressIndexId(CHAIN, "0xVAULT");
    assert.equal(id, `${CHAIN}-0xvault`);
  });

  it("getVaultEventId uses txHash and logIndex", () => {
    const id = getVaultEventId(CHAIN, "0xTX", 5);
    assert.equal(id, `${CHAIN}-0xTX-5`);
  });

  it("getVaultEventId handles bigint logIndex", () => {
    const id = getVaultEventId(CHAIN, "0xTX", 5n);
    assert.equal(id, `${CHAIN}-0xTX-5`);
  });

  it("getYieldAllocationId uses txHash and logIndex", () => {
    const id = getYieldAllocationId(CHAIN, "0xTX", 3);
    assert.equal(id, `${CHAIN}-0xTX-3`);
  });

  it("getYieldAccumulationId normalizes addresses", () => {
    const id = getYieldAccumulationId(CHAIN, GARDEN, ASSET);
    assert.equal(id, `${CHAIN}-${GARDEN.toLowerCase()}-${ASSET.toLowerCase()}`);
  });

  it("getYieldFractionPurchaseId includes hypercertId", () => {
    const id = getYieldFractionPurchaseId(CHAIN, "0xTX", 1, 42n);
    assert.equal(id, `${CHAIN}-0xTX-1-42`);
  });

  it("getYieldEventId matches getVaultEventId format", () => {
    const yield_id = getYieldEventId(CHAIN, "0xTX", 7);
    const vault_id = getVaultEventId(CHAIN, "0xTX", 7);
    assert.equal(yield_id, vault_id);
  });

  it("getCookieJarId normalizes addresses", () => {
    const id = getCookieJarId(CHAIN, GARDEN, ASSET);
    assert.equal(id, `${CHAIN}-${GARDEN.toLowerCase()}-${ASSET.toLowerCase()}`);
  });

  it("getGardenCommunityId normalizes garden", () => {
    const id = getGardenCommunityId(CHAIN, GARDEN);
    assert.equal(id, `${CHAIN}-${GARDEN.toLowerCase()}`);
  });

  it("getGardenSignalPoolId normalizes addresses", () => {
    const id = getGardenSignalPoolId(CHAIN, GARDEN, "0xPOOL");
    assert.equal(id, `${CHAIN}-${GARDEN.toLowerCase()}-0xpool`);
  });

  it("getMarketplaceOrderId uses orderId", () => {
    const id = getMarketplaceOrderId(CHAIN, 42n);
    assert.equal(id, `${CHAIN}-42`);
  });

  it("getMarketplacePurchaseId uses txHash and logIndex", () => {
    const id = getMarketplacePurchaseId(CHAIN, "0xTX", 3);
    assert.equal(id, `${CHAIN}-0xTX-3`);
  });
});

// ============================================================================
// mapWeightScheme / mapPoolType / mapENSNameType
// ============================================================================

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

// ============================================================================
// resolveIpfsUri
// ============================================================================

describe("resolveIpfsUri", () => {
  it("converts ipfs:// URIs to gateway URL", () => {
    const result = resolveIpfsUri("ipfs://bafkreiabc123");
    assert.equal(result, `${DEFAULT_IPFS_GATEWAY}bafkreiabc123`);
  });

  it("passes through non-IPFS URIs unchanged", () => {
    const url = "https://example.com/metadata.json";
    assert.equal(resolveIpfsUri(url), url);
  });

  it("passes through empty string unchanged", () => {
    assert.equal(resolveIpfsUri(""), "");
  });
});

// ============================================================================
// isRecord / getString / getStringArray
// ============================================================================

describe("isRecord", () => {
  it("returns true for plain objects", () => {
    assert.equal(isRecord({}), true);
    assert.equal(isRecord({ key: "value" }), true);
  });

  it("returns false for arrays", () => {
    assert.equal(isRecord([]), false);
  });

  it("returns false for null", () => {
    assert.equal(isRecord(null), false);
  });

  it("returns false for primitives", () => {
    assert.equal(isRecord("string"), false);
    assert.equal(isRecord(42), false);
    assert.equal(isRecord(undefined), false);
  });
});

describe("getString", () => {
  it("returns string values", () => {
    assert.equal(getString("hello"), "hello");
  });

  it("returns undefined for non-strings", () => {
    assert.equal(getString(42), undefined);
    assert.equal(getString(null), undefined);
    assert.equal(getString(undefined), undefined);
    assert.equal(getString({}), undefined);
  });
});

describe("getStringArray", () => {
  it("returns array of strings", () => {
    assert.deepEqual(getStringArray(["a", "b"]), ["a", "b"]);
  });

  it("filters out non-string entries", () => {
    assert.deepEqual(getStringArray(["a", 42, "b"]), ["a", "b"]);
  });

  it("returns undefined for non-arrays", () => {
    assert.equal(getStringArray("not array"), undefined);
    assert.equal(getStringArray(42), undefined);
    assert.equal(getStringArray(null), undefined);
  });

  it("returns undefined for empty string array after filtering", () => {
    assert.equal(getStringArray([42, true, null]), undefined);
  });
});

// ============================================================================
// parseHypercertMetadata
// ============================================================================

describe("parseHypercertMetadata", () => {
  it("returns empty object for non-record input", () => {
    assert.deepEqual(parseHypercertMetadata(null), {});
    assert.deepEqual(parseHypercertMetadata("string"), {});
    assert.deepEqual(parseHypercertMetadata(42), {});
  });

  it("extracts top-level title, description, imageUri", () => {
    const result = parseHypercertMetadata({
      name: "Test Cert",
      description: "A test hypercert",
      image: "ipfs://bafk-image",
    });

    assert.equal(result.title, "Test Cert");
    assert.equal(result.description, "A test hypercert");
    assert.equal(result.imageUri, `${DEFAULT_IPFS_GATEWAY}bafk-image`);
  });

  it("extracts work scopes from hypercert.work_scope.value", () => {
    const result = parseHypercertMetadata({
      hypercert: {
        work_scope: {
          value: ["scope-a", "scope-b"],
        },
      },
    });

    assert.deepEqual(result.workScopes, ["scope-a", "scope-b"]);
  });

  it("extracts gardenId and attestationUIDs from hidden_properties", () => {
    const result = parseHypercertMetadata({
      hidden_properties: {
        gardenId: "0xgarden",
        attestationRefs: [{ uid: "0xatt-1" }, { uid: "0xatt-2" }],
      },
    });

    assert.equal(result.gardenId, "0xgarden");
    assert.deepEqual(result.attestationUIDs, ["0xatt-1", "0xatt-2"]);
  });

  it("handles missing optional fields gracefully", () => {
    const result = parseHypercertMetadata({});

    assert.equal(result.title, undefined);
    assert.equal(result.description, undefined);
    assert.equal(result.imageUri, undefined);
    assert.equal(result.workScopes, undefined);
    assert.equal(result.gardenId, undefined);
    assert.equal(result.attestationUIDs, undefined);
  });

  it("skips non-object attestationRefs entries", () => {
    const result = parseHypercertMetadata({
      hidden_properties: {
        attestationRefs: ["not-an-object", { uid: "0xatt-1" }, null],
      },
    });

    assert.deepEqual(result.attestationUIDs, ["0xatt-1"]);
  });

  it("returns undefined attestationUIDs when refs have no uids", () => {
    const result = parseHypercertMetadata({
      hidden_properties: {
        attestationRefs: [{ notUid: "value" }],
      },
    });

    assert.equal(result.attestationUIDs, undefined);
  });
});

// ============================================================================
// createDefaultGardenVault
// ============================================================================

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

// ============================================================================
// createDefaultHypercert
// ============================================================================

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

// ============================================================================
// Constants
// ============================================================================

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
