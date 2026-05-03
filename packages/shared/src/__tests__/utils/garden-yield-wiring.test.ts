import { describe, expect, it } from "vitest";

import {
  annotateGardenSignalPools,
  deriveGardenYieldWiringState,
  type GardenYieldWiringSnapshot,
} from "../../utils/blockchain/garden-yield-wiring";
import type { Address } from "../../types/domain";
import { PoolType } from "../../types/gardens-community";
import { ZERO_ADDRESS } from "../../utils/blockchain/address";

const TEST_GARDEN = "0x3333333333333333333333333333333333333333" as Address;
const TEST_GARDENS_MODULE = "0x6666666666666666666666666666666666666666" as Address;
const TEST_YIELD_RESOLVER = "0x8888888888888888888888888888888888888888" as Address;
const TEST_ACTION_POOL = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const TEST_HYPERCERT_POOL = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const TEST_OTHER_POOL = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;
const TEST_COMMUNITY = "0x7777777777777777777777777777777777777777" as Address;

function wiringSnapshot(
  overrides: Partial<GardenYieldWiringSnapshot> = {}
): GardenYieldWiringSnapshot {
  return {
    readStatus: "available",
    gardenAddress: TEST_GARDEN,
    gardensModuleAddress: TEST_GARDENS_MODULE,
    yieldResolverAddress: TEST_YIELD_RESOLVER,
    moduleYieldResolverAddress: TEST_YIELD_RESOLVER,
    resolverGardensModuleAddress: TEST_GARDENS_MODULE,
    typedHypercertPoolAddress: TEST_HYPERCERT_POOL,
    resolverHypercertPoolAddress: TEST_HYPERCERT_POOL,
    ...overrides,
  };
}

describe("deriveGardenYieldWiringState", () => {
  it("reports connected when typed pool, resolver pool, and bidirectional wiring match", () => {
    const state = deriveGardenYieldWiringState(wiringSnapshot());

    expect(state).toMatchObject({
      readStatus: "available",
      status: "connected",
      gardenAddress: TEST_GARDEN,
      gardensModuleAddress: TEST_GARDENS_MODULE,
      yieldResolverAddress: TEST_YIELD_RESOLVER,
      expectedHypercertPoolAddress: TEST_HYPERCERT_POOL,
      resolverHypercertPoolAddress: TEST_HYPERCERT_POOL,
      canRepairFromCommunity: false,
    });
    expect(state.repairHref).toBeUndefined();
  });

  it("reports missing-pool when GardensModule has no typed HypercertSignal pool", () => {
    const state = deriveGardenYieldWiringState(
      wiringSnapshot({
        typedHypercertPoolAddress: ZERO_ADDRESS,
        resolverHypercertPoolAddress: ZERO_ADDRESS,
      })
    );

    expect(state).toMatchObject({
      readStatus: "available",
      status: "missing-pool",
      expectedHypercertPoolAddress: undefined,
      resolverHypercertPoolAddress: undefined,
      canRepairFromCommunity: true,
      repairHref: `/community/governance?gardenAddress=${TEST_GARDEN}`,
    });
    expect(state.issues).toContain("typed-hypercert-pool-missing");
  });

  it("reports missing-resolver-wiring when the typed pool exists but resolver wiring is absent", () => {
    const state = deriveGardenYieldWiringState(
      wiringSnapshot({
        moduleYieldResolverAddress: ZERO_ADDRESS,
        resolverGardensModuleAddress: ZERO_ADDRESS,
        resolverHypercertPoolAddress: ZERO_ADDRESS,
      })
    );

    expect(state).toMatchObject({
      readStatus: "available",
      status: "missing-resolver-wiring",
      expectedHypercertPoolAddress: TEST_HYPERCERT_POOL,
      resolverHypercertPoolAddress: undefined,
      canRepairFromCommunity: true,
      repairHref: `/community/governance?gardenAddress=${TEST_GARDEN}`,
    });
    expect(state.issues).toEqual(
      expect.arrayContaining([
        "gardens-module-yield-resolver-missing",
        "yield-resolver-gardens-module-missing",
        "resolver-hypercert-pool-missing",
      ])
    );
  });

  it("reports mismatch when the resolver points at a different pool than the typed pool", () => {
    const state = deriveGardenYieldWiringState(
      wiringSnapshot({
        resolverHypercertPoolAddress: TEST_OTHER_POOL,
      })
    );

    expect(state).toMatchObject({
      readStatus: "available",
      status: "mismatch",
      expectedHypercertPoolAddress: TEST_HYPERCERT_POOL,
      resolverHypercertPoolAddress: TEST_OTHER_POOL,
      canRepairFromCommunity: true,
      repairHref: `/community/governance?gardenAddress=${TEST_GARDEN}`,
    });
    expect(state.issues).toContain("resolver-hypercert-pool-mismatch");
  });

  it("keeps contract-read failures separate from wiring statuses", () => {
    const state = deriveGardenYieldWiringState({
      readStatus: "unavailable",
      gardenAddress: TEST_GARDEN,
      gardensModuleAddress: TEST_GARDENS_MODULE,
      yieldResolverAddress: TEST_YIELD_RESOLVER,
      readErrorMessage: "RPC unavailable",
    });

    expect(state).toMatchObject({
      readStatus: "unavailable",
      status: undefined,
      gardenAddress: TEST_GARDEN,
      canRepairFromCommunity: false,
      readErrorMessage: "RPC unavailable",
    });
    expect(state.issues).toContain("contract-read-unavailable");
    expect(state.repairHref).toBeUndefined();
  });
});

describe("annotateGardenSignalPools", () => {
  it("uses the typed HypercertSignal pool mapping instead of array position", () => {
    const pools = annotateGardenSignalPools({
      poolAddresses: [TEST_HYPERCERT_POOL, TEST_ACTION_POOL],
      typedHypercertPoolAddress: TEST_HYPERCERT_POOL,
      gardenAddress: TEST_GARDEN,
      communityAddress: TEST_COMMUNITY,
    });

    expect(pools).toEqual([
      {
        poolAddress: TEST_HYPERCERT_POOL,
        poolType: PoolType.Hypercert,
        gardenAddress: TEST_GARDEN,
        communityAddress: TEST_COMMUNITY,
      },
      {
        poolAddress: TEST_ACTION_POOL,
        poolType: PoolType.Action,
        gardenAddress: TEST_GARDEN,
        communityAddress: TEST_COMMUNITY,
      },
    ]);
  });
});
