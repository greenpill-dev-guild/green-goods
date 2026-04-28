/**
 * Query key contract tests.
 *
 * These stay intentionally focused: verify the shared root, representative key
 * builders, normalization behavior, and the invalidation helpers that fan out
 * across package boundaries. Avoid mirroring every literal array shape.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_DELAY,
  INDEXER_LAG_FOLLOWUP_MS,
  INDEXER_LAG_SCHEDULE_MS,
  queryInvalidation,
  queryKeys,
  STALE_TIME_FAST,
  STALE_TIME_MEDIUM,
  STALE_TIME_RARE,
  STALE_TIME_SLOW,
} from "../../config/query-keys";
import type { Address } from "../../types/domain";
import type { AttestationFilters } from "../../types/hypercerts";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x3333333333333333333333333333333333333333";
const TEST_USER = "0x1111111111111111111111111111111111111111" as Address;
const TEST_OPERATOR = "0x2222222222222222222222222222222222222222" as Address;
const TEST_POOL = "0x4444444444444444444444444444444444444444";
const TEST_JAR = "0x5555555555555555555555555555555555555555";
const TEST_VAULT = "0x6666666666666666666666666666666666666666";
const TEST_ASSET = "0x7777777777777777777777777777777777777777";
const TEST_HYPERCERT_ID = "hypercert-123";
const TEST_DRAFT_ID = "draft-456";

function expectRooted(key: readonly unknown[], prefix: readonly unknown[]) {
  expect(key.slice(0, prefix.length)).toEqual(prefix);
}

describe("query key constants", () => {
  it("keeps stale-time tiers ordered from fast to rare", () => {
    expect(STALE_TIME_FAST).toBe(5_000);
    expect(STALE_TIME_MEDIUM).toBe(30_000);
    expect(STALE_TIME_SLOW).toBe(60_000);
    expect(STALE_TIME_RARE).toBe(300_000);
    expect(STALE_TIME_FAST).toBeLessThan(STALE_TIME_MEDIUM);
    expect(STALE_TIME_MEDIUM).toBeLessThan(STALE_TIME_SLOW);
    expect(STALE_TIME_SLOW).toBeLessThan(STALE_TIME_RARE);
  });

  it("keeps retry and indexer lag defaults stable", () => {
    expect(DEFAULT_RETRY_COUNT).toBe(3);
    expect(DEFAULT_RETRY_DELAY).toBe(1_000);
    expect(INDEXER_LAG_FOLLOWUP_MS).toBe(2_000);
    expect(INDEXER_LAG_SCHEDULE_MS).toEqual([2_000, 5_000, 15_000]);
  });
});

describe("queryKeys", () => {
  it("uses one shared root namespace", () => {
    expect(queryKeys.all).toEqual(["greengoods"]);

    const roots = [
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
      queryKeys.platform.all,
      queryKeys.actions.all,
      queryKeys.assessments.all,
      queryKeys.gardeners.all,
      queryKeys.gardenerProfile.all,
      queryKeys.ens.all,
      queryKeys.role.all,
      queryKeys.drafts.all,
      queryKeys.hypercerts.all,
      queryKeys.marketplace.all,
      queryKeys.greenWill.all,
    ];

    roots.forEach((root) => expectRooted(root, queryKeys.all));
  });

  it("builds representative keys without mutating caller input", () => {
    const gardenIds = ["garden-c", "garden-a", "garden-b"];
    const approvalsKey = queryKeys.approvals.byOperatorGardens(gardenIds);
    const myWorkApprovalsKey = queryKeys.approvals.byMyWorkGardens(TEST_USER, gardenIds);
    const operatorKey = queryKeys.operatorWorks.byAddress(TEST_OPERATOR, gardenIds);

    expect(approvalsKey[3]).toBe(JSON.stringify(["garden-a", "garden-b", "garden-c"]));
    expect(myWorkApprovalsKey[3]).toBe(TEST_USER);
    expect(myWorkApprovalsKey[4]).toBe(JSON.stringify(["garden-a", "garden-b", "garden-c"]));
    expect(operatorKey[3]).toBe(JSON.stringify(["garden-a", "garden-b", "garden-c"]));
    expect(gardenIds).toEqual(["garden-c", "garden-a", "garden-b"]);
  });

  it("serializes bigint inputs for preview keys", () => {
    expect(queryKeys.vaults.preview(TEST_VAULT, 1000n, 500n, TEST_USER, TEST_CHAIN_ID)).toEqual([
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

  it("keeps prefix-compatible list keys for works, assessments, and yield", () => {
    expectRooted(queryKeys.works.online(TEST_GARDEN, TEST_CHAIN_ID), queryKeys.works.all);
    expect(queryKeys.works.mineByUser(TEST_USER)).toEqual([
      "greengoods",
      "works",
      "mine",
      TEST_USER,
    ]);
    expectRooted(
      queryKeys.works.mine(TEST_USER, TEST_CHAIN_ID, true, "week", 50),
      queryKeys.works.mineByUser(TEST_USER)
    );
    expectRooted(
      queryKeys.assessments.byGarden(TEST_GARDEN, TEST_CHAIN_ID, 25),
      queryKeys.assessments.byGardenBase(TEST_GARDEN, TEST_CHAIN_ID)
    );
    expectRooted(
      queryKeys.yield.allocations(TEST_GARDEN, TEST_CHAIN_ID, 10),
      queryKeys.yield.allocationsBase(TEST_GARDEN, TEST_CHAIN_ID)
    );
  });

  it("keeps stable keys for identical inputs", () => {
    expect(queryKeys.works.online(TEST_GARDEN, TEST_CHAIN_ID)).toEqual(
      queryKeys.works.online(TEST_GARDEN, TEST_CHAIN_ID)
    );
    expect(queryKeys.marketplace.preview(TEST_HYPERCERT_ID, "100", "ETH", TEST_CHAIN_ID)).toEqual(
      queryKeys.marketplace.preview(TEST_HYPERCERT_ID, "100", "ETH", TEST_CHAIN_ID)
    );
  });

  it("normalizes hypercert attestation filters for cache stability", () => {
    const filtersA: AttestationFilters = {
      gardenerAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12" as Address,
      searchQuery: "  restoration  ",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      domain: 2,
    };
    const filtersB: AttestationFilters = {
      gardenerAddress: "0xabcdef1234567890abcdef1234567890abcdef12" as Address,
      searchQuery: "restoration",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      domain: 2,
    };

    const keyA = queryKeys.hypercerts.attestations(TEST_GARDEN, filtersA);
    const keyB = queryKeys.hypercerts.attestations(TEST_GARDEN, filtersB);

    expect(keyA).toEqual(keyB);
    expect(keyA[4]).toContain('"gardenerAddress":"0xabcdef1234567890abcdef1234567890abcdef12"');
    expect(keyA[4]).toContain('"searchQuery":"restoration"');
  });

  it("covers representative domain-specific key builders", () => {
    expect(queryKeys.queue.jobs({ kind: "work", synced: false })).toEqual([
      "greengoods",
      "queue",
      "jobs",
      { kind: "work", synced: false },
    ]);
    expect(queryKeys.role.evaluatorGardens(TEST_OPERATOR, ["g2", "g1"])).toEqual([
      "greengoods",
      "role",
      "evaluatorGardens",
      TEST_OPERATOR,
      JSON.stringify(["g1", "g2"]),
    ]);
    expect(queryKeys.marketplace.orders(TEST_GARDEN, TEST_CHAIN_ID)).toEqual([
      "greengoods",
      "marketplace",
      "orders",
      TEST_GARDEN,
      TEST_CHAIN_ID,
    ]);
    expect(queryKeys.greenWill.recentGrants(TEST_CHAIN_ID, 10)).toEqual([
      "greengoods",
      "greenWill",
      "recentGrants",
      TEST_CHAIN_ID,
      10,
    ]);
  });
});

describe("queryInvalidation", () => {
  it("invalidates queued user work when jobs are added", () => {
    const baseKeys = queryInvalidation.onJobAdded(TEST_GARDEN, TEST_CHAIN_ID);
    const userKeys = queryInvalidation.onJobAdded(TEST_GARDEN, TEST_CHAIN_ID, TEST_USER);

    expect(baseKeys).toEqual(
      expect.arrayContaining([
        queryKeys.queue.stats(),
        queryKeys.queue.pendingCount(),
        queryKeys.works.offline(TEST_GARDEN),
        queryKeys.works.merged(TEST_GARDEN, TEST_CHAIN_ID),
      ])
    );
    expect(baseKeys).not.toContainEqual(queryKeys.works.mineByUser(TEST_USER));
    expect(userKeys).toContainEqual(queryKeys.works.mineByUser(TEST_USER));
  });

  it("fans out job completion invalidation across queue and works", () => {
    const baseKeys = queryInvalidation.onJobCompleted(TEST_GARDEN, TEST_CHAIN_ID);
    const userKeys = queryInvalidation.onJobCompleted(TEST_GARDEN, TEST_CHAIN_ID, TEST_USER);

    expect(baseKeys).toEqual(
      expect.arrayContaining([
        queryKeys.queue.stats(),
        queryKeys.queue.pendingCount(),
        queryKeys.works.all,
        queryKeys.works.online(TEST_GARDEN, TEST_CHAIN_ID),
        queryKeys.works.merged(TEST_GARDEN, TEST_CHAIN_ID),
        queryKeys.works.approvals(),
        queryKeys.works.approvals(undefined, TEST_CHAIN_ID),
      ])
    );
    expect(userKeys).toContainEqual(queryKeys.works.approvals(TEST_USER, TEST_CHAIN_ID));
    expect(userKeys).toContainEqual(queryKeys.works.mineByUser(TEST_USER));
  });

  it("falls back to root marketplace invalidation when scope is incomplete", () => {
    expect(queryInvalidation.invalidateMarketplace(TEST_GARDEN, TEST_CHAIN_ID)).toEqual(
      expect.arrayContaining([
        queryKeys.marketplace.orders(TEST_GARDEN, TEST_CHAIN_ID),
        queryKeys.marketplace.all,
      ])
    );
    expect(queryInvalidation.invalidateMarketplace(TEST_GARDEN)).toEqual([
      queryKeys.marketplace.all,
    ]);
    expect(queryInvalidation.invalidateMarketplace()).toEqual([queryKeys.marketplace.all]);
  });

  it("builds ENS registration invalidation from the provided inputs", () => {
    expect(queryInvalidation.invalidateEnsRegistration("my-garden", TEST_USER)).toEqual(
      expect.arrayContaining([
        queryKeys.ens.registrationStatus("my-garden"),
        queryKeys.ens.availability("my-garden"),
        queryKeys.ens.protocolMembership(TEST_USER),
      ])
    );
    expect(queryInvalidation.invalidateEnsRegistration()).toEqual([queryKeys.ens.all]);
  });

  it("falls back to the assessments root when scope is incomplete", () => {
    expect(queryInvalidation.invalidateAssessments(TEST_GARDEN, TEST_CHAIN_ID)).toEqual(
      expect.arrayContaining([
        queryKeys.assessments.byGardenBase(TEST_GARDEN, TEST_CHAIN_ID),
        queryKeys.gardens.byChain(TEST_CHAIN_ID),
        queryKeys.gardens.detail(TEST_GARDEN, TEST_CHAIN_ID),
      ])
    );
    expect(queryInvalidation.invalidateAssessments(TEST_GARDEN)).toEqual([
      queryKeys.assessments.all,
    ]);
  });

  it("keeps finance invalidation targeted to the affected scopes", () => {
    expect(queryInvalidation.onVaultDeposit(TEST_GARDEN, TEST_USER, TEST_CHAIN_ID)).toEqual(
      expect.arrayContaining([
        queryKeys.vaults.byGarden(TEST_GARDEN, TEST_CHAIN_ID),
        queryKeys.vaults.deposits(TEST_GARDEN, TEST_CHAIN_ID),
        queryKeys.vaults.eventsBase(TEST_GARDEN, TEST_CHAIN_ID),
        queryKeys.vaults.myDeposits(TEST_GARDEN, TEST_USER, TEST_CHAIN_ID),
        queryKeys.vaults.myDepositsByUser(TEST_USER, TEST_CHAIN_ID),
      ])
    );

    expect(queryInvalidation.onYieldAllocated(TEST_GARDEN, TEST_ASSET, TEST_CHAIN_ID)).toEqual(
      expect.arrayContaining([
        queryKeys.yield.allocationsBase(TEST_GARDEN, TEST_CHAIN_ID),
        queryKeys.yield.byAsset(TEST_ASSET, TEST_CHAIN_ID),
        queryKeys.yield.pendingYield(TEST_GARDEN, TEST_ASSET, TEST_CHAIN_ID),
        queryKeys.yield.all,
      ])
    );

    expect(queryInvalidation.onPoolConfigChanged(TEST_POOL, TEST_CHAIN_ID)).toEqual(
      expect.arrayContaining([
        queryKeys.conviction.convictionWeights(TEST_POOL, TEST_CHAIN_ID),
        queryKeys.conviction.registeredHypercerts(TEST_POOL, TEST_CHAIN_ID),
        queryKeys.conviction.all,
      ])
    );

    expect(
      queryInvalidation.onCookieJarWithdraw(TEST_GARDEN, TEST_JAR, TEST_USER, TEST_CHAIN_ID)
    ).toEqual(
      expect.arrayContaining([
        queryKeys.cookieJar.byGarden(TEST_GARDEN, TEST_CHAIN_ID),
        queryKeys.cookieJar.jarDetail(TEST_JAR, TEST_CHAIN_ID),
        queryKeys.cookieJar.userHistory(TEST_JAR, TEST_USER, TEST_CHAIN_ID),
      ])
    );
  });

  it("keeps queue, works, and offline sync grouped for full sync completion", () => {
    expect(queryInvalidation.onSyncCompleted()).toEqual(
      expect.arrayContaining([queryKeys.queue.all, queryKeys.works.all, queryKeys.offline.sync()])
    );
  });

  it("keeps draft invalidation scoped to the affected list and detail keys", () => {
    expect(queryInvalidation.invalidateDrafts(TEST_USER, TEST_CHAIN_ID)).toEqual(
      expect.arrayContaining([
        queryKeys.drafts.all,
        queryKeys.drafts.list(TEST_USER, TEST_CHAIN_ID),
      ])
    );
    expect(queryInvalidation.invalidateDraft(TEST_DRAFT_ID)).toEqual(
      expect.arrayContaining([
        queryKeys.drafts.detail(TEST_DRAFT_ID),
        queryKeys.drafts.images(TEST_DRAFT_ID),
      ])
    );
  });
});
