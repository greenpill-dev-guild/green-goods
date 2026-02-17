/**
 * Query Keys Test Suite
 * @vitest-environment jsdom
 *
 * Tests the centralized query key factory and invalidation helpers.
 * Validates key shapes, hierarchical prefixes, serialization stability,
 * and conditional logic in invalidation functions.
 */

import { describe, expect, it } from "vitest";
import {
  queryKeys,
  queryInvalidation,
  STALE_TIME_FAST,
  STALE_TIME_MEDIUM,
  STALE_TIME_SLOW,
  STALE_TIME_RARE,
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_DELAY,
  INDEXER_LAG_FOLLOWUP_MS,
} from "../../hooks/query-keys";
import type { Address } from "../../types/domain";

// ============================================
// Test Constants
// ============================================

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x3333333333333333333333333333333333333333";
const TEST_USER = "0x1111111111111111111111111111111111111111" as Address;
const TEST_OPERATOR = "0x2222222222222222222222222222222222222222" as Address;
const TEST_POOL = "0x4444444444444444444444444444444444444444";
const TEST_VOTER = "0x5555555555555555555555555555555555555555";
const TEST_JAR = "0x6666666666666666666666666666666666666666";
const TEST_VAULT = "0x7777777777777777777777777777777777777777";
const TEST_ASSET = "0x8888888888888888888888888888888888888888";
const TEST_HYPERCERT_ID = "hypercert-123";
const TEST_DRAFT_ID = "draft-456";

// ============================================
// Stale Time Constants
// ============================================

describe("Stale Time Constants", () => {
  it("defines increasing stale time intervals", () => {
    expect(STALE_TIME_FAST).toBe(5_000);
    expect(STALE_TIME_MEDIUM).toBe(30_000);
    expect(STALE_TIME_SLOW).toBe(60_000);
    expect(STALE_TIME_RARE).toBe(300_000);

    // Values should be strictly increasing
    expect(STALE_TIME_FAST).toBeLessThan(STALE_TIME_MEDIUM);
    expect(STALE_TIME_MEDIUM).toBeLessThan(STALE_TIME_SLOW);
    expect(STALE_TIME_SLOW).toBeLessThan(STALE_TIME_RARE);
  });

  it("defines default retry configuration", () => {
    expect(DEFAULT_RETRY_COUNT).toBe(3);
    expect(DEFAULT_RETRY_DELAY).toBe(1000);
  });

  it("defines indexer lag followup delay", () => {
    expect(INDEXER_LAG_FOLLOWUP_MS).toBe(2000);
  });
});

// ============================================
// Query Key Factory: Structure & Hierarchy
// ============================================

describe("queryKeys", () => {
  describe("root key", () => {
    it("has a top-level greengoods key", () => {
      expect(queryKeys.all).toEqual(["greengoods"]);
    });
  });

  // ------------------------------------------
  // Queue keys
  // ------------------------------------------

  describe("queue", () => {
    it("has static all key nested under greengoods", () => {
      expect(queryKeys.queue.all).toEqual(["greengoods", "queue"]);
    });

    it("generates stats key", () => {
      expect(queryKeys.queue.stats()).toEqual(["greengoods", "queue", "stats"]);
    });

    it("generates jobs key with optional filter", () => {
      expect(queryKeys.queue.jobs()).toEqual(["greengoods", "queue", "jobs", undefined]);
      expect(queryKeys.queue.jobs({ kind: "work" })).toEqual([
        "greengoods",
        "queue",
        "jobs",
        { kind: "work" },
      ]);
      expect(queryKeys.queue.jobs({ synced: true })).toEqual([
        "greengoods",
        "queue",
        "jobs",
        { synced: true },
      ]);
      expect(queryKeys.queue.jobs({ kind: "upload", synced: false })).toEqual([
        "greengoods",
        "queue",
        "jobs",
        { kind: "upload", synced: false },
      ]);
    });

    it("generates pendingCount key", () => {
      expect(queryKeys.queue.pendingCount()).toEqual(["greengoods", "queue", "pendingCount"]);
    });

    it("generates uploading key", () => {
      expect(queryKeys.queue.uploading()).toEqual(["greengoods", "queue", "uploading"]);
    });

    it("all key is a prefix of factory-generated keys", () => {
      const all = queryKeys.queue.all;
      expect(queryKeys.queue.stats().slice(0, all.length)).toEqual(all);
      expect(queryKeys.queue.jobs().slice(0, all.length)).toEqual(all);
      expect(queryKeys.queue.pendingCount().slice(0, all.length)).toEqual(all);
    });
  });

  // ------------------------------------------
  // Works keys
  // ------------------------------------------

  describe("works", () => {
    it("has static all key", () => {
      expect(queryKeys.works.all).toEqual(["greengoods", "works"]);
    });

    it("generates online key with gardenId and chainId", () => {
      expect(queryKeys.works.online(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "works",
        "online",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates offline key with gardenId only", () => {
      expect(queryKeys.works.offline(TEST_GARDEN)).toEqual([
        "greengoods",
        "works",
        "offline",
        TEST_GARDEN,
      ]);
    });

    it("generates merged key", () => {
      expect(queryKeys.works.merged(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "works",
        "merged",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates approvals key with optional params", () => {
      expect(queryKeys.works.approvals()).toEqual([
        "greengoods",
        "works",
        "approvals",
        undefined,
        undefined,
      ]);
      expect(queryKeys.works.approvals(TEST_USER, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "works",
        "approvals",
        TEST_USER,
        TEST_CHAIN_ID,
      ]);
    });

    it("all key is a prefix of factory-generated keys", () => {
      const all = queryKeys.works.all;
      expect(queryKeys.works.online(TEST_GARDEN, TEST_CHAIN_ID).slice(0, all.length)).toEqual(all);
      expect(queryKeys.works.offline(TEST_GARDEN).slice(0, all.length)).toEqual(all);
      expect(queryKeys.works.merged(TEST_GARDEN, TEST_CHAIN_ID).slice(0, all.length)).toEqual(all);
      expect(queryKeys.works.approvals().slice(0, all.length)).toEqual(all);
    });
  });

  // ------------------------------------------
  // Work Approvals keys
  // ------------------------------------------

  describe("workApprovals", () => {
    it("has static all key", () => {
      expect(queryKeys.workApprovals.all).toEqual(["greengoods", "workApprovals"]);
    });

    it("generates byAttester key with optional params", () => {
      expect(queryKeys.workApprovals.byAttester()).toEqual([
        "greengoods",
        "workApprovals",
        "byAttester",
        undefined,
        undefined,
      ]);
      expect(queryKeys.workApprovals.byAttester(TEST_OPERATOR as string, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "workApprovals",
        "byAttester",
        TEST_OPERATOR,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates offline key", () => {
      expect(queryKeys.workApprovals.offline(TEST_OPERATOR as string)).toEqual([
        "greengoods",
        "workApprovals",
        "offline",
        TEST_OPERATOR,
      ]);
    });
  });

  // ------------------------------------------
  // Approvals (aggregated by operator gardens)
  // ------------------------------------------

  describe("approvals", () => {
    it("has static all key", () => {
      expect(queryKeys.approvals.all).toEqual(["greengoods", "approvals"]);
    });

    it("generates byOperatorGardens key with sorted serialized gardenIds", () => {
      const gardenIds = ["garden-c", "garden-a", "garden-b"];
      const result = queryKeys.approvals.byOperatorGardens(gardenIds);

      expect(result[0]).toBe("greengoods");
      expect(result[1]).toBe("approvals");
      expect(result[2]).toBe("byOperatorGardens");
      // gardenIds should be sorted and serialized
      expect(result[3]).toBe(JSON.stringify(["garden-a", "garden-b", "garden-c"]));
    });

    it("produces stable keys regardless of input order", () => {
      const key1 = queryKeys.approvals.byOperatorGardens(["b", "a", "c"]);
      const key2 = queryKeys.approvals.byOperatorGardens(["c", "a", "b"]);
      expect(key1).toEqual(key2);
    });

    it("does not mutate the original array", () => {
      const original = ["z", "a", "m"];
      const originalCopy = [...original];
      queryKeys.approvals.byOperatorGardens(original);
      expect(original).toEqual(originalCopy);
    });
  });

  // ------------------------------------------
  // Operator Works
  // ------------------------------------------

  describe("operatorWorks", () => {
    it("has static all key", () => {
      expect(queryKeys.operatorWorks.all).toEqual(["greengoods", "operatorWorks"]);
    });

    it("generates byAddress key with sorted serialized gardenIds", () => {
      const gardenIds = ["g2", "g1"];
      const result = queryKeys.operatorWorks.byAddress(TEST_OPERATOR, gardenIds);

      expect(result).toEqual([
        "greengoods",
        "operatorWorks",
        TEST_OPERATOR,
        JSON.stringify(["g1", "g2"]),
      ]);
    });

    it("handles undefined address", () => {
      const result = queryKeys.operatorWorks.byAddress(undefined, ["g1"]);
      expect(result[2]).toBeUndefined();
    });
  });

  // ------------------------------------------
  // Offline keys
  // ------------------------------------------

  describe("offline", () => {
    it("has static all key", () => {
      expect(queryKeys.offline.all).toEqual(["greengoods", "offline"]);
    });

    it("generates status and sync keys", () => {
      expect(queryKeys.offline.status()).toEqual(["greengoods", "offline", "status"]);
      expect(queryKeys.offline.sync()).toEqual(["greengoods", "offline", "sync"]);
    });
  });

  // ------------------------------------------
  // Media keys
  // ------------------------------------------

  describe("media", () => {
    it("has static all key", () => {
      expect(queryKeys.media.all).toEqual(["greengoods", "media"]);
    });

    it("generates forJob key", () => {
      expect(queryKeys.media.forJob("job-123")).toEqual(["greengoods", "media", "job", "job-123"]);
    });
  });

  // ------------------------------------------
  // Garden keys
  // ------------------------------------------

  describe("gardens", () => {
    it("has static all key", () => {
      expect(queryKeys.gardens.all).toEqual(["greengoods", "gardens"]);
    });

    it("generates byChain key", () => {
      expect(queryKeys.gardens.byChain(TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "gardens",
        TEST_CHAIN_ID,
      ]);
    });

    it("generates detail key", () => {
      expect(queryKeys.gardens.detail(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "gardens",
        "detail",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
    });
  });

  // ------------------------------------------
  // Vault keys
  // ------------------------------------------

  describe("vaults", () => {
    it("has static all key", () => {
      expect(queryKeys.vaults.all).toEqual(["greengoods", "vaults"]);
    });

    it("generates byChain key", () => {
      expect(queryKeys.vaults.byChain(TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "vaults",
        "chain",
        TEST_CHAIN_ID,
      ]);
    });

    it("generates byGarden key", () => {
      expect(queryKeys.vaults.byGarden(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "vaults",
        "garden",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates deposits key", () => {
      expect(queryKeys.vaults.deposits(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "vaults",
        "deposits",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates myDeposits key", () => {
      expect(queryKeys.vaults.myDeposits(TEST_GARDEN, TEST_USER, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "vaults",
        "myDeposits",
        TEST_GARDEN,
        TEST_USER,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates eventsBase and events keys", () => {
      expect(queryKeys.vaults.eventsBase(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "vaults",
        "events",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
      expect(queryKeys.vaults.events(TEST_GARDEN, TEST_CHAIN_ID, 50)).toEqual([
        "greengoods",
        "vaults",
        "events",
        TEST_GARDEN,
        TEST_CHAIN_ID,
        50,
      ]);
      // events without limit
      expect(queryKeys.vaults.events(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "vaults",
        "events",
        TEST_GARDEN,
        TEST_CHAIN_ID,
        undefined,
      ]);
    });

    it("generates preview key with bigint stringification", () => {
      const result = queryKeys.vaults.preview(
        TEST_VAULT,
        1000n,
        500n,
        TEST_USER,
        TEST_CHAIN_ID
      );
      expect(result).toEqual([
        "greengoods",
        "vaults",
        "preview",
        TEST_VAULT,
        "1000",
        "500",
        TEST_USER,
        TEST_CHAIN_ID,
      ]);
    });

    it("handles undefined bigint values in preview key", () => {
      const result = queryKeys.vaults.preview(TEST_VAULT);
      expect(result).toEqual([
        "greengoods",
        "vaults",
        "preview",
        TEST_VAULT,
        undefined,
        undefined,
        undefined,
        undefined,
      ]);
    });
  });

  // ------------------------------------------
  // Cookie Jar keys
  // ------------------------------------------

  describe("cookieJar", () => {
    it("has static all key", () => {
      expect(queryKeys.cookieJar.all).toEqual(["greengoods", "cookieJar"]);
    });

    it("generates byGarden key", () => {
      expect(queryKeys.cookieJar.byGarden(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "cookieJar",
        "garden",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates jarDetail key", () => {
      expect(queryKeys.cookieJar.jarDetail(TEST_JAR, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "cookieJar",
        "detail",
        TEST_JAR,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates userHistory key", () => {
      expect(queryKeys.cookieJar.userHistory(TEST_JAR, TEST_USER, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "cookieJar",
        "history",
        TEST_JAR,
        TEST_USER,
        TEST_CHAIN_ID,
      ]);
    });
  });

  // ------------------------------------------
  // Conviction keys
  // ------------------------------------------

  describe("conviction", () => {
    it("has static all key", () => {
      expect(queryKeys.conviction.all).toEqual(["greengoods", "conviction"]);
    });

    it("generates strategies key", () => {
      expect(queryKeys.conviction.strategies(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "conviction",
        "strategies",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates registeredHypercerts key", () => {
      expect(queryKeys.conviction.registeredHypercerts(TEST_POOL, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "conviction",
        "registeredHypercerts",
        TEST_POOL,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates convictionWeights key", () => {
      expect(queryKeys.conviction.convictionWeights(TEST_POOL, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "conviction",
        "convictionWeights",
        TEST_POOL,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates memberPower key", () => {
      expect(queryKeys.conviction.memberPower(TEST_POOL, TEST_VOTER, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "conviction",
        "memberPower",
        TEST_POOL,
        TEST_VOTER,
        TEST_CHAIN_ID,
      ]);
    });
  });

  // ------------------------------------------
  // Community keys
  // ------------------------------------------

  describe("community", () => {
    it("has static all key", () => {
      expect(queryKeys.community.all).toEqual(["greengoods", "community"]);
    });

    it("generates garden and pools keys", () => {
      expect(queryKeys.community.garden(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "community",
        "garden",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
      expect(queryKeys.community.pools(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "community",
        "pools",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
    });
  });

  // ------------------------------------------
  // Yield keys
  // ------------------------------------------

  describe("yield", () => {
    it("has static all key", () => {
      expect(queryKeys.yield.all).toEqual(["greengoods", "yield"]);
    });

    it("generates allocationsBase and allocations keys", () => {
      expect(queryKeys.yield.allocationsBase(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "yield",
        "allocations",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
      expect(queryKeys.yield.allocations(TEST_GARDEN, TEST_CHAIN_ID, 10)).toEqual([
        "greengoods",
        "yield",
        "allocations",
        TEST_GARDEN,
        TEST_CHAIN_ID,
        10,
      ]);
    });

    it("allocationsBase is a prefix of allocations", () => {
      const base = queryKeys.yield.allocationsBase(TEST_GARDEN, TEST_CHAIN_ID);
      const full = queryKeys.yield.allocations(TEST_GARDEN, TEST_CHAIN_ID, 10);
      expect(full.slice(0, base.length)).toEqual(base);
    });

    it("generates byAsset, splitConfig, and pendingYield keys", () => {
      expect(queryKeys.yield.byAsset(TEST_ASSET, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "yield",
        "byAsset",
        TEST_ASSET,
        TEST_CHAIN_ID,
      ]);
      expect(queryKeys.yield.splitConfig(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "yield",
        "splitConfig",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
      expect(queryKeys.yield.pendingYield(TEST_GARDEN, TEST_ASSET, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "yield",
        "pending",
        TEST_GARDEN,
        TEST_ASSET,
        TEST_CHAIN_ID,
      ]);
    });
  });

  // ------------------------------------------
  // Actions keys
  // ------------------------------------------

  describe("actions", () => {
    it("has static all key", () => {
      expect(queryKeys.actions.all).toEqual(["greengoods", "actions"]);
    });

    it("generates byChain key", () => {
      expect(queryKeys.actions.byChain(TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "actions",
        TEST_CHAIN_ID,
      ]);
    });
  });

  // ------------------------------------------
  // Assessment keys
  // ------------------------------------------

  describe("assessments", () => {
    it("has static all key", () => {
      expect(queryKeys.assessments.all).toEqual(["greengoods", "assessments"]);
    });

    it("generates byGardenBase and byGarden keys", () => {
      expect(queryKeys.assessments.byGardenBase(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "assessments",
        "byGarden",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
      expect(queryKeys.assessments.byGarden(TEST_GARDEN, TEST_CHAIN_ID, 25)).toEqual([
        "greengoods",
        "assessments",
        "byGarden",
        TEST_GARDEN,
        TEST_CHAIN_ID,
        25,
      ]);
    });

    it("byGardenBase is a prefix of byGarden", () => {
      const base = queryKeys.assessments.byGardenBase(TEST_GARDEN, TEST_CHAIN_ID);
      const full = queryKeys.assessments.byGarden(TEST_GARDEN, TEST_CHAIN_ID, 25);
      expect(full.slice(0, base.length)).toEqual(base);
    });
  });

  // ------------------------------------------
  // Gardener keys
  // ------------------------------------------

  describe("gardeners", () => {
    it("has static all key", () => {
      expect(queryKeys.gardeners.all).toEqual(["greengoods", "gardeners"]);
    });

    it("generates byAddress key", () => {
      expect(queryKeys.gardeners.byAddress(TEST_USER)).toEqual([
        "greengoods",
        "gardeners",
        "byAddress",
        TEST_USER,
      ]);
    });
  });

  // ------------------------------------------
  // Gardener Profile keys
  // ------------------------------------------

  describe("gardenerProfile", () => {
    it("has static all key", () => {
      expect(queryKeys.gardenerProfile.all).toEqual(["greengoods", "gardener-profile"]);
    });

    it("generates byAddress key", () => {
      expect(queryKeys.gardenerProfile.byAddress(TEST_USER, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "gardener-profile",
        TEST_USER,
        TEST_CHAIN_ID,
      ]);
    });
  });

  // ------------------------------------------
  // ENS keys
  // ------------------------------------------

  describe("ens", () => {
    it("has static all key", () => {
      expect(queryKeys.ens.all).toEqual(["greengoods", "ens"]);
    });

    it("generates name, address, and avatar keys", () => {
      expect(queryKeys.ens.name(TEST_USER)).toEqual(["greengoods", "ens", "name", TEST_USER]);
      expect(queryKeys.ens.address("vitalik.eth")).toEqual([
        "greengoods",
        "ens",
        "address",
        "vitalik.eth",
      ]);
      expect(queryKeys.ens.avatar(TEST_USER)).toEqual(["greengoods", "ens", "avatar", TEST_USER]);
    });

    it("generates registrationStatus and availability keys", () => {
      expect(queryKeys.ens.registrationStatus("my-garden")).toEqual([
        "greengoods",
        "ens",
        "registration",
        "my-garden",
      ]);
      expect(queryKeys.ens.availability("my-garden")).toEqual([
        "greengoods",
        "ens",
        "availability",
        "my-garden",
      ]);
    });

    it("generates protocolMembership key", () => {
      expect(queryKeys.ens.protocolMembership(TEST_USER)).toEqual([
        "greengoods",
        "ens",
        "protocolMembership",
        TEST_USER,
      ]);
    });
  });

  // ------------------------------------------
  // Role keys
  // ------------------------------------------

  describe("role", () => {
    it("has static all key", () => {
      expect(queryKeys.role.all).toEqual(["greengoods", "role"]);
    });

    it("generates operatorGardens key with optional address", () => {
      expect(queryKeys.role.operatorGardens()).toEqual([
        "greengoods",
        "role",
        "operatorGardens",
        undefined,
      ]);
      expect(queryKeys.role.operatorGardens(TEST_OPERATOR)).toEqual([
        "greengoods",
        "role",
        "operatorGardens",
        TEST_OPERATOR,
      ]);
    });

    it("generates gardenRoles key", () => {
      expect(queryKeys.role.gardenRoles(TEST_GARDEN, TEST_USER)).toEqual([
        "greengoods",
        "role",
        "gardenRoles",
        TEST_GARDEN,
        TEST_USER,
      ]);
    });

    it("generates hasRole key", () => {
      expect(queryKeys.role.hasRole(TEST_GARDEN, TEST_USER, "operator")).toEqual([
        "greengoods",
        "role",
        "hasRole",
        TEST_GARDEN,
        TEST_USER,
        "operator",
      ]);
    });

    it("generates evaluatorGardens key with sorted serialized gardenIds", () => {
      const result = queryKeys.role.evaluatorGardens(TEST_OPERATOR, ["g2", "g1", "g3"]);
      expect(result).toEqual([
        "greengoods",
        "role",
        "evaluatorGardens",
        TEST_OPERATOR,
        JSON.stringify(["g1", "g2", "g3"]),
      ]);
    });

    it("evaluatorGardens defaults to empty gardenIds", () => {
      const result = queryKeys.role.evaluatorGardens(TEST_OPERATOR);
      expect(result[4]).toBe(JSON.stringify([]));
    });
  });

  // ------------------------------------------
  // Draft keys
  // ------------------------------------------

  describe("drafts", () => {
    it("has static all key", () => {
      expect(queryKeys.drafts.all).toEqual(["greengoods", "drafts"]);
    });

    it("generates list, detail, and images keys", () => {
      expect(queryKeys.drafts.list(TEST_USER, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "drafts",
        "list",
        TEST_USER,
        TEST_CHAIN_ID,
      ]);
      expect(queryKeys.drafts.detail(TEST_DRAFT_ID)).toEqual([
        "greengoods",
        "drafts",
        "detail",
        TEST_DRAFT_ID,
      ]);
      expect(queryKeys.drafts.images(TEST_DRAFT_ID)).toEqual([
        "greengoods",
        "drafts",
        "images",
        TEST_DRAFT_ID,
      ]);
    });
  });

  // ------------------------------------------
  // Hypercert keys
  // ------------------------------------------

  describe("hypercerts", () => {
    it("has static all key", () => {
      expect(queryKeys.hypercerts.all).toEqual(["greengoods", "hypercerts"]);
    });

    it("generates attestations key with serialized filters", () => {
      const result = queryKeys.hypercerts.attestations(TEST_GARDEN);
      expect(result).toEqual([
        "greengoods",
        "hypercerts",
        "attestations",
        TEST_GARDEN,
        "", // no filters => empty string
      ]);
    });

    it("serializes attestation filters deterministically", () => {
      // The serializeAttestationFilters function sorts arrays and lowercases addresses
      const filters = {
        status: ["approved", "pending"],
        domain: ["agro", "edu"],
        gardenerAddress: "0xABCDef1234567890ABCDef1234567890ABCDef12",
      };

      const result = queryKeys.hypercerts.attestations(TEST_GARDEN, filters as any);
      const serialized = result[4] as string;
      const parsed = JSON.parse(serialized);

      // Arrays should be sorted
      expect(parsed.status).toEqual(["approved", "pending"]);
      expect(parsed.domain).toEqual(["agro", "edu"]);
      // Address should be lowercased
      expect(parsed.gardenerAddress).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    });

    it("produces stable serialization regardless of array order in filters", () => {
      const filters1 = { status: ["pending", "approved"], domain: ["edu", "agro"] };
      const filters2 = { status: ["approved", "pending"], domain: ["agro", "edu"] };

      const key1 = queryKeys.hypercerts.attestations(TEST_GARDEN, filters1 as any);
      const key2 = queryKeys.hypercerts.attestations(TEST_GARDEN, filters2 as any);

      expect(key1).toEqual(key2);
    });

    it("generates list, detail, and drafts keys", () => {
      expect(queryKeys.hypercerts.list(TEST_GARDEN, "active")).toEqual([
        "greengoods",
        "hypercerts",
        "list",
        TEST_GARDEN,
        "active",
      ]);
      expect(queryKeys.hypercerts.detail(TEST_HYPERCERT_ID)).toEqual([
        "greengoods",
        "hypercerts",
        "detail",
        TEST_HYPERCERT_ID,
      ]);
      expect(queryKeys.hypercerts.drafts(TEST_GARDEN, TEST_OPERATOR as string)).toEqual([
        "greengoods",
        "hypercerts",
        "drafts",
        TEST_GARDEN,
        TEST_OPERATOR,
      ]);
    });
  });

  // ------------------------------------------
  // Marketplace keys
  // ------------------------------------------

  describe("marketplace", () => {
    it("has static all key", () => {
      expect(queryKeys.marketplace.all).toEqual(["greengoods", "marketplace"]);
    });

    it("generates orders key", () => {
      expect(queryKeys.marketplace.orders(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "marketplace",
        "orders",
        TEST_GARDEN,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates activeOrder key", () => {
      expect(queryKeys.marketplace.activeOrder(TEST_HYPERCERT_ID, "ETH", TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "marketplace",
        "active-order",
        TEST_HYPERCERT_ID,
        "ETH",
        TEST_CHAIN_ID,
      ]);
    });

    it("generates sellerOrders key", () => {
      expect(queryKeys.marketplace.sellerOrders(TEST_OPERATOR as string, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "marketplace",
        "seller-orders",
        TEST_OPERATOR,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates preview key", () => {
      expect(
        queryKeys.marketplace.preview(TEST_HYPERCERT_ID, "100", "ETH", TEST_CHAIN_ID)
      ).toEqual([
        "greengoods",
        "marketplace",
        "preview",
        TEST_HYPERCERT_ID,
        "100",
        "ETH",
        TEST_CHAIN_ID,
      ]);
    });

    it("generates tradeHistory key", () => {
      expect(queryKeys.marketplace.tradeHistory(TEST_HYPERCERT_ID, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "marketplace",
        "trades",
        TEST_HYPERCERT_ID,
        TEST_CHAIN_ID,
      ]);
    });

    it("generates approvals key", () => {
      expect(queryKeys.marketplace.approvals(TEST_OPERATOR as string, TEST_CHAIN_ID)).toEqual([
        "greengoods",
        "marketplace",
        "approvals",
        TEST_OPERATOR,
        TEST_CHAIN_ID,
      ]);
    });
  });

  // ------------------------------------------
  // Serialization Stability (cross-domain)
  // ------------------------------------------

  describe("serialization stability", () => {
    it("produces identical keys for same inputs across calls", () => {
      const key1 = queryKeys.works.online(TEST_GARDEN, TEST_CHAIN_ID);
      const key2 = queryKeys.works.online(TEST_GARDEN, TEST_CHAIN_ID);
      expect(key1).toEqual(key2);

      const key3 = queryKeys.vaults.preview(TEST_VAULT, 1000n, 500n, TEST_USER, TEST_CHAIN_ID);
      const key4 = queryKeys.vaults.preview(TEST_VAULT, 1000n, 500n, TEST_USER, TEST_CHAIN_ID);
      expect(key3).toEqual(key4);
    });

    it("produces different keys for different inputs", () => {
      const key1 = queryKeys.gardens.detail("garden-a", TEST_CHAIN_ID);
      const key2 = queryKeys.gardens.detail("garden-b", TEST_CHAIN_ID);
      expect(key1).not.toEqual(key2);

      const key3 = queryKeys.gardens.detail(TEST_GARDEN, 11155111);
      const key4 = queryKeys.gardens.detail(TEST_GARDEN, 42161);
      expect(key3).not.toEqual(key4);
    });

    it("all domain all-keys start with greengoods prefix", () => {
      const domains = [
        queryKeys.queue.all,
        queryKeys.works.all,
        queryKeys.workApprovals.all,
        queryKeys.approvals.all,
        queryKeys.operatorWorks.all,
        queryKeys.offline.all,
        queryKeys.media.all,
        queryKeys.gardens.all,
        queryKeys.vaults.all,
        queryKeys.cookieJar.all,
        queryKeys.conviction.all,
        queryKeys.community.all,
        queryKeys.yield.all,
        queryKeys.actions.all,
        queryKeys.assessments.all,
        queryKeys.gardeners.all,
        queryKeys.gardenerProfile.all,
        queryKeys.ens.all,
        queryKeys.role.all,
        queryKeys.drafts.all,
        queryKeys.hypercerts.all,
        queryKeys.marketplace.all,
      ];

      for (const key of domains) {
        expect(key[0]).toBe("greengoods");
        expect(key.length).toBe(2);
      }
    });
  });
});

// ============================================
// Query Invalidation Helpers
// ============================================

describe("queryInvalidation", () => {
  describe("invalidateAll", () => {
    it("returns the root greengoods key", () => {
      expect(queryInvalidation.invalidateAll()).toEqual(["greengoods"]);
    });
  });

  describe("invalidateQueueStats", () => {
    it("returns queue stats key", () => {
      expect(queryInvalidation.invalidateQueueStats()).toEqual(queryKeys.queue.stats());
    });
  });

  describe("invalidateWorksForGarden", () => {
    it("returns online, offline, and merged keys for a garden", () => {
      const result = queryInvalidation.invalidateWorksForGarden(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(queryKeys.works.online(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.works.offline(TEST_GARDEN));
      expect(result).toContainEqual(queryKeys.works.merged(TEST_GARDEN, TEST_CHAIN_ID));
    });
  });

  describe("invalidateAllWorks", () => {
    it("returns works.all key", () => {
      expect(queryInvalidation.invalidateAllWorks()).toEqual(queryKeys.works.all);
    });
  });

  describe("invalidateOfflineState", () => {
    it("returns offline.all key", () => {
      expect(queryInvalidation.invalidateOfflineState()).toEqual(queryKeys.offline.all);
    });
  });

  describe("onJobAdded", () => {
    it("returns queue stats, pendingCount, and work keys", () => {
      const result = queryInvalidation.onJobAdded(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(4);
      expect(result).toContainEqual(queryKeys.queue.stats());
      expect(result).toContainEqual(queryKeys.queue.pendingCount());
      expect(result).toContainEqual(queryKeys.works.offline(TEST_GARDEN));
      expect(result).toContainEqual(queryKeys.works.merged(TEST_GARDEN, TEST_CHAIN_ID));
    });
  });

  describe("onJobCompleted", () => {
    it("returns queue, work online/merged/approvals, and works.all keys", () => {
      const result = queryInvalidation.onJobCompleted(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(6);
      expect(result).toContainEqual(queryKeys.queue.stats());
      expect(result).toContainEqual(queryKeys.queue.pendingCount());
      expect(result).toContainEqual(queryKeys.works.all);
      expect(result).toContainEqual(queryKeys.works.online(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.works.merged(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.works.approvals());
    });
  });

  describe("onSyncCompleted", () => {
    it("returns queue.all, works.all, and offline.sync keys", () => {
      const result = queryInvalidation.onSyncCompleted();
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(queryKeys.queue.all);
      expect(result).toContainEqual(queryKeys.works.all);
      expect(result).toContainEqual(queryKeys.offline.sync());
    });
  });

  describe("invalidateGardens", () => {
    it("returns gardens.all and gardens.byChain keys", () => {
      const result = queryInvalidation.invalidateGardens(TEST_CHAIN_ID);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.gardens.all);
      expect(result).toContainEqual(queryKeys.gardens.byChain(TEST_CHAIN_ID));
    });
  });

  describe("invalidateGarden", () => {
    it("returns byChain and detail keys for specific garden", () => {
      const result = queryInvalidation.invalidateGarden(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.gardens.byChain(TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.gardens.detail(TEST_GARDEN, TEST_CHAIN_ID));
    });
  });

  describe("invalidateDrafts", () => {
    it("returns drafts.all and drafts.list keys", () => {
      const result = queryInvalidation.invalidateDrafts(TEST_USER, TEST_CHAIN_ID);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.drafts.all);
      expect(result).toContainEqual(queryKeys.drafts.list(TEST_USER, TEST_CHAIN_ID));
    });
  });

  describe("invalidateDraft", () => {
    it("returns detail and images keys for specific draft", () => {
      const result = queryInvalidation.invalidateDraft(TEST_DRAFT_ID);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.drafts.detail(TEST_DRAFT_ID));
      expect(result).toContainEqual(queryKeys.drafts.images(TEST_DRAFT_ID));
    });
  });

  describe("invalidateHypercerts", () => {
    it("returns hypercerts.all, list, and attestations keys", () => {
      const result = queryInvalidation.invalidateHypercerts(TEST_GARDEN);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(queryKeys.hypercerts.all);
      expect(result).toContainEqual(queryKeys.hypercerts.list(TEST_GARDEN));
      expect(result).toContainEqual(queryKeys.hypercerts.attestations(TEST_GARDEN));
    });

    it("works without gardenId", () => {
      const result = queryInvalidation.invalidateHypercerts();
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(queryKeys.hypercerts.all);
    });
  });

  // ------------------------------------------
  // Marketplace invalidation (conditional logic)
  // ------------------------------------------

  describe("invalidateMarketplace", () => {
    it("returns orders + all when gardenAddress and chainId are provided", () => {
      const result = queryInvalidation.invalidateMarketplace(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.marketplace.orders(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.marketplace.all);
    });

    it("returns only all when gardenAddress is missing", () => {
      const result = queryInvalidation.invalidateMarketplace(undefined, TEST_CHAIN_ID);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(queryKeys.marketplace.all);
    });

    it("returns only all when chainId is missing", () => {
      const result = queryInvalidation.invalidateMarketplace(TEST_GARDEN, undefined);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(queryKeys.marketplace.all);
    });

    it("returns only all when both params are missing", () => {
      const result = queryInvalidation.invalidateMarketplace();
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(queryKeys.marketplace.all);
    });
  });

  describe("onMarketplaceListingChanged", () => {
    it("returns orders and all keys", () => {
      const result = queryInvalidation.onMarketplaceListingChanged(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.marketplace.orders(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.marketplace.all);
    });
  });

  describe("onFractionPurchased", () => {
    it("returns tradeHistory and all keys", () => {
      const result = queryInvalidation.onFractionPurchased(TEST_HYPERCERT_ID, TEST_CHAIN_ID);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(
        queryKeys.marketplace.tradeHistory(TEST_HYPERCERT_ID, TEST_CHAIN_ID)
      );
      expect(result).toContainEqual(queryKeys.marketplace.all);
    });
  });

  // ------------------------------------------
  // Gardener Profile invalidation (conditional)
  // ------------------------------------------

  describe("invalidateGardenerProfile", () => {
    it("returns specific profile key when address and chainId are provided", () => {
      const result = queryInvalidation.invalidateGardenerProfile(
        TEST_USER,
        TEST_CHAIN_ID
      );
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(
        queryKeys.gardenerProfile.byAddress(TEST_USER as Address, TEST_CHAIN_ID)
      );
    });

    it("returns gardenerProfile.all when address is missing", () => {
      const result = queryInvalidation.invalidateGardenerProfile(undefined, TEST_CHAIN_ID);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(queryKeys.gardenerProfile.all);
    });

    it("returns gardenerProfile.all when chainId is missing", () => {
      const result = queryInvalidation.invalidateGardenerProfile(TEST_USER);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(queryKeys.gardenerProfile.all);
    });
  });

  // ------------------------------------------
  // ENS invalidation (conditional)
  // ------------------------------------------

  describe("invalidateEns", () => {
    it("returns name and avatar keys when address is provided", () => {
      const result = queryInvalidation.invalidateEns(TEST_USER);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.ens.name(TEST_USER));
      expect(result).toContainEqual(queryKeys.ens.avatar(TEST_USER));
    });

    it("returns ens.all when address is missing", () => {
      const result = queryInvalidation.invalidateEns();
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(queryKeys.ens.all);
    });
  });

  describe("invalidateEnsRegistration", () => {
    it("returns registrationStatus and availability when slug is provided", () => {
      const result = queryInvalidation.invalidateEnsRegistration("my-garden");
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.ens.registrationStatus("my-garden"));
      expect(result).toContainEqual(queryKeys.ens.availability("my-garden"));
    });

    it("returns protocolMembership when address is provided", () => {
      const result = queryInvalidation.invalidateEnsRegistration(undefined, TEST_USER);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(queryKeys.ens.protocolMembership(TEST_USER));
    });

    it("returns all three keys when both slug and address are provided", () => {
      const result = queryInvalidation.invalidateEnsRegistration("my-garden", TEST_USER);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(queryKeys.ens.registrationStatus("my-garden"));
      expect(result).toContainEqual(queryKeys.ens.availability("my-garden"));
      expect(result).toContainEqual(queryKeys.ens.protocolMembership(TEST_USER));
    });

    it("falls back to ens.all when neither slug nor address is provided", () => {
      const result = queryInvalidation.invalidateEnsRegistration();
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(queryKeys.ens.all);
    });
  });

  // ------------------------------------------
  // Assessment invalidation (conditional)
  // ------------------------------------------

  describe("invalidateAssessments", () => {
    it("returns byGardenBase when gardenAddress and chainId are provided", () => {
      const result = queryInvalidation.invalidateAssessments(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(
        queryKeys.assessments.byGardenBase(TEST_GARDEN, TEST_CHAIN_ID)
      );
    });

    it("returns assessments.all when params are missing", () => {
      expect(queryInvalidation.invalidateAssessments()).toContainEqual(queryKeys.assessments.all);
      expect(queryInvalidation.invalidateAssessments(TEST_GARDEN)).toContainEqual(
        queryKeys.assessments.all
      );
      expect(queryInvalidation.invalidateAssessments(undefined, TEST_CHAIN_ID)).toContainEqual(
        queryKeys.assessments.all
      );
    });
  });

  // ------------------------------------------
  // Community invalidation
  // ------------------------------------------

  describe("invalidateCommunity", () => {
    it("returns garden and pools keys", () => {
      const result = queryInvalidation.invalidateCommunity(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.community.garden(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.community.pools(TEST_GARDEN, TEST_CHAIN_ID));
    });
  });

  // ------------------------------------------
  // Yield invalidation
  // ------------------------------------------

  describe("invalidateYield", () => {
    it("returns allocationsBase and splitConfig keys", () => {
      const result = queryInvalidation.invalidateYield(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(
        queryKeys.yield.allocationsBase(TEST_GARDEN, TEST_CHAIN_ID)
      );
      expect(result).toContainEqual(queryKeys.yield.splitConfig(TEST_GARDEN, TEST_CHAIN_ID));
    });
  });

  describe("onCommunityCreated", () => {
    it("returns garden, pools, and all keys", () => {
      const result = queryInvalidation.onCommunityCreated(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(queryKeys.community.garden(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.community.pools(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.community.all);
    });
  });

  describe("onYieldAllocated", () => {
    it("returns allocationsBase, byAsset, pendingYield, and yield.all keys", () => {
      const result = queryInvalidation.onYieldAllocated(
        TEST_GARDEN,
        TEST_ASSET,
        TEST_CHAIN_ID
      );
      expect(result).toHaveLength(4);
      expect(result).toContainEqual(
        queryKeys.yield.allocationsBase(TEST_GARDEN, TEST_CHAIN_ID)
      );
      expect(result).toContainEqual(queryKeys.yield.byAsset(TEST_ASSET, TEST_CHAIN_ID));
      expect(result).toContainEqual(
        queryKeys.yield.pendingYield(TEST_GARDEN, TEST_ASSET, TEST_CHAIN_ID)
      );
      expect(result).toContainEqual(queryKeys.yield.all);
    });
  });

  describe("onSplitRatioUpdated", () => {
    it("returns splitConfig key", () => {
      const result = queryInvalidation.onSplitRatioUpdated(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(queryKeys.yield.splitConfig(TEST_GARDEN, TEST_CHAIN_ID));
    });
  });

  // ------------------------------------------
  // Conviction invalidation
  // ------------------------------------------

  describe("onConvictionStrategiesUpdated", () => {
    it("returns strategies key", () => {
      const result = queryInvalidation.onConvictionStrategiesUpdated(
        TEST_GARDEN,
        TEST_CHAIN_ID
      );
      expect(result).toHaveLength(1);
      expect(result).toContainEqual(
        queryKeys.conviction.strategies(TEST_GARDEN, TEST_CHAIN_ID)
      );
    });
  });

  describe("onSupportAllocated", () => {
    it("returns convictionWeights and memberPower keys", () => {
      const result = queryInvalidation.onSupportAllocated(
        TEST_POOL,
        TEST_VOTER,
        TEST_CHAIN_ID
      );
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(
        queryKeys.conviction.convictionWeights(TEST_POOL, TEST_CHAIN_ID)
      );
      expect(result).toContainEqual(
        queryKeys.conviction.memberPower(TEST_POOL, TEST_VOTER, TEST_CHAIN_ID)
      );
    });
  });

  describe("onPoolConfigChanged", () => {
    it("returns convictionWeights, registeredHypercerts, and conviction.all keys", () => {
      const result = queryInvalidation.onPoolConfigChanged(TEST_POOL, TEST_CHAIN_ID);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(
        queryKeys.conviction.convictionWeights(TEST_POOL, TEST_CHAIN_ID)
      );
      expect(result).toContainEqual(
        queryKeys.conviction.registeredHypercerts(TEST_POOL, TEST_CHAIN_ID)
      );
      expect(result).toContainEqual(queryKeys.conviction.all);
    });
  });

  describe("onHypercertRegistrationChanged", () => {
    it("returns registeredHypercerts and convictionWeights keys", () => {
      const result = queryInvalidation.onHypercertRegistrationChanged(
        TEST_POOL,
        TEST_CHAIN_ID
      );
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(
        queryKeys.conviction.registeredHypercerts(TEST_POOL, TEST_CHAIN_ID)
      );
      expect(result).toContainEqual(
        queryKeys.conviction.convictionWeights(TEST_POOL, TEST_CHAIN_ID)
      );
    });
  });

  // ------------------------------------------
  // Vault invalidation (conditional)
  // ------------------------------------------

  describe("onVaultDeposit", () => {
    it("returns byGarden, deposits, and eventsBase when no userAddress", () => {
      const result = queryInvalidation.onVaultDeposit(TEST_GARDEN, undefined, TEST_CHAIN_ID);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(queryKeys.vaults.byGarden(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.vaults.deposits(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.vaults.eventsBase(TEST_GARDEN, TEST_CHAIN_ID));
    });

    it("includes myDeposits when userAddress is provided", () => {
      const result = queryInvalidation.onVaultDeposit(TEST_GARDEN, TEST_USER, TEST_CHAIN_ID);
      expect(result).toHaveLength(4);
      expect(result).toContainEqual(
        queryKeys.vaults.myDeposits(TEST_GARDEN, TEST_USER, TEST_CHAIN_ID)
      );
    });
  });

  describe("onVaultWithdraw", () => {
    it("delegates to onVaultDeposit (same invalidation pattern)", () => {
      const depositResult = queryInvalidation.onVaultDeposit(
        TEST_GARDEN,
        TEST_USER,
        TEST_CHAIN_ID
      );
      const withdrawResult = queryInvalidation.onVaultWithdraw(
        TEST_GARDEN,
        TEST_USER,
        TEST_CHAIN_ID
      );
      expect(withdrawResult).toEqual(depositResult);
    });
  });

  describe("onVaultHarvest", () => {
    it("returns byGarden and eventsBase keys", () => {
      const result = queryInvalidation.onVaultHarvest(TEST_GARDEN, TEST_CHAIN_ID);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.vaults.byGarden(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.vaults.eventsBase(TEST_GARDEN, TEST_CHAIN_ID));
    });
  });

  // ------------------------------------------
  // Cookie Jar invalidation (conditional)
  // ------------------------------------------

  describe("onCookieJarWithdraw", () => {
    it("returns byGarden and jarDetail when no userAddress", () => {
      const result = queryInvalidation.onCookieJarWithdraw(
        TEST_GARDEN,
        TEST_JAR,
        undefined,
        TEST_CHAIN_ID
      );
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.cookieJar.byGarden(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.cookieJar.jarDetail(TEST_JAR, TEST_CHAIN_ID));
    });

    it("includes userHistory when userAddress is provided", () => {
      const result = queryInvalidation.onCookieJarWithdraw(
        TEST_GARDEN,
        TEST_JAR,
        TEST_USER,
        TEST_CHAIN_ID
      );
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(
        queryKeys.cookieJar.userHistory(TEST_JAR, TEST_USER, TEST_CHAIN_ID)
      );
    });
  });

  describe("onCookieJarDeposit", () => {
    it("returns byGarden and jarDetail keys", () => {
      const result = queryInvalidation.onCookieJarDeposit(
        TEST_GARDEN,
        TEST_JAR,
        TEST_CHAIN_ID
      );
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.cookieJar.byGarden(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.cookieJar.jarDetail(TEST_JAR, TEST_CHAIN_ID));
    });
  });

  describe("onCookieJarAdminAction", () => {
    it("returns byGarden and jarDetail keys", () => {
      const result = queryInvalidation.onCookieJarAdminAction(
        TEST_GARDEN,
        TEST_JAR,
        TEST_CHAIN_ID
      );
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(queryKeys.cookieJar.byGarden(TEST_GARDEN, TEST_CHAIN_ID));
      expect(result).toContainEqual(queryKeys.cookieJar.jarDetail(TEST_JAR, TEST_CHAIN_ID));
    });
  });
});
