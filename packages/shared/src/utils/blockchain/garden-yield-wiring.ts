import { adminRoutes } from "../navigation/admin-routes";
import type { Address } from "../../types/domain";
import { type GardenSignalPool, PoolType } from "../../types/gardens-community";
import { compareAddresses, isZeroAddress, normalizeAddress } from "./address";

export type GardenYieldWiringStatus =
  | "connected"
  | "missing-pool"
  | "missing-resolver-wiring"
  | "mismatch";

export type GardenYieldWiringReadStatus = "available" | "unavailable";

export type GardenYieldWiringIssue =
  | "contract-read-unavailable"
  | "typed-hypercert-pool-missing"
  | "yield-resolver-missing"
  | "gardens-module-yield-resolver-missing"
  | "gardens-module-yield-resolver-mismatch"
  | "yield-resolver-gardens-module-missing"
  | "yield-resolver-gardens-module-mismatch"
  | "resolver-hypercert-pool-missing"
  | "resolver-hypercert-pool-mismatch";

export interface GardenYieldWiringSnapshot {
  readStatus: GardenYieldWiringReadStatus;
  gardenAddress: Address;
  gardensModuleAddress?: Address | null;
  yieldResolverAddress?: Address | null;
  moduleYieldResolverAddress?: Address | null;
  resolverGardensModuleAddress?: Address | null;
  typedHypercertPoolAddress?: Address | null;
  resolverHypercertPoolAddress?: Address | null;
  readErrorMessage?: string;
}

export interface GardenYieldWiringState {
  readStatus: GardenYieldWiringReadStatus;
  status?: GardenYieldWiringStatus;
  gardenAddress: Address;
  gardensModuleAddress?: Address;
  yieldResolverAddress?: Address;
  moduleYieldResolverAddress?: Address;
  resolverGardensModuleAddress?: Address;
  expectedHypercertPoolAddress?: Address;
  resolverHypercertPoolAddress?: Address;
  canRepairFromCommunity: boolean;
  repairHref?: string;
  issues: GardenYieldWiringIssue[];
  readErrorMessage?: string;
}

interface AnnotateGardenSignalPoolsInput {
  poolAddresses: readonly Address[];
  typedHypercertPoolAddress?: Address | null;
  gardenAddress: Address;
  communityAddress: Address;
}

function normalizeNonZeroAddress(
  address: Address | string | null | undefined
): Address | undefined {
  if (!address || isZeroAddress(address)) return undefined;
  return normalizeAddress(address) as Address;
}

function repairHrefForGarden(gardenAddress: Address): string {
  return adminRoutes.communityGovernance({ gardenId: gardenAddress });
}

export function deriveGardenYieldWiringState(
  snapshot: GardenYieldWiringSnapshot
): GardenYieldWiringState {
  const gardenAddress = normalizeNonZeroAddress(snapshot.gardenAddress) ?? snapshot.gardenAddress;
  const gardensModuleAddress = normalizeNonZeroAddress(snapshot.gardensModuleAddress);
  const yieldResolverAddress = normalizeNonZeroAddress(snapshot.yieldResolverAddress);
  const moduleYieldResolverAddress = normalizeNonZeroAddress(snapshot.moduleYieldResolverAddress);
  const resolverGardensModuleAddress = normalizeNonZeroAddress(
    snapshot.resolverGardensModuleAddress
  );
  const expectedHypercertPoolAddress = normalizeNonZeroAddress(snapshot.typedHypercertPoolAddress);
  const resolverHypercertPoolAddress = normalizeNonZeroAddress(
    snapshot.resolverHypercertPoolAddress
  );

  if (snapshot.readStatus === "unavailable") {
    return {
      readStatus: "unavailable",
      status: undefined,
      gardenAddress,
      gardensModuleAddress,
      yieldResolverAddress,
      canRepairFromCommunity: false,
      issues: ["contract-read-unavailable"],
      readErrorMessage: snapshot.readErrorMessage,
    };
  }

  const baseState = {
    readStatus: "available" as const,
    gardenAddress,
    gardensModuleAddress,
    yieldResolverAddress,
    moduleYieldResolverAddress,
    resolverGardensModuleAddress,
    expectedHypercertPoolAddress,
    resolverHypercertPoolAddress,
  };

  if (!expectedHypercertPoolAddress) {
    return {
      ...baseState,
      status: "missing-pool",
      canRepairFromCommunity: true,
      repairHref: repairHrefForGarden(gardenAddress),
      issues: ["typed-hypercert-pool-missing"],
    };
  }

  const resolverIssues: GardenYieldWiringIssue[] = [];
  if (!yieldResolverAddress) {
    resolverIssues.push("yield-resolver-missing");
  }

  if (!moduleYieldResolverAddress) {
    resolverIssues.push("gardens-module-yield-resolver-missing");
  } else if (
    yieldResolverAddress &&
    !compareAddresses(moduleYieldResolverAddress, yieldResolverAddress)
  ) {
    resolverIssues.push("gardens-module-yield-resolver-mismatch");
  }

  if (!resolverGardensModuleAddress) {
    resolverIssues.push("yield-resolver-gardens-module-missing");
  } else if (
    gardensModuleAddress &&
    !compareAddresses(resolverGardensModuleAddress, gardensModuleAddress)
  ) {
    resolverIssues.push("yield-resolver-gardens-module-mismatch");
  }

  if (!resolverHypercertPoolAddress) {
    resolverIssues.push("resolver-hypercert-pool-missing");
  }

  if (resolverIssues.length > 0) {
    return {
      ...baseState,
      status: "missing-resolver-wiring",
      canRepairFromCommunity: true,
      repairHref: repairHrefForGarden(gardenAddress),
      issues: resolverIssues,
    };
  }

  if (!compareAddresses(resolverHypercertPoolAddress, expectedHypercertPoolAddress)) {
    return {
      ...baseState,
      status: "mismatch",
      canRepairFromCommunity: true,
      repairHref: repairHrefForGarden(gardenAddress),
      issues: ["resolver-hypercert-pool-mismatch"],
    };
  }

  return {
    ...baseState,
    status: "connected",
    canRepairFromCommunity: false,
    issues: [],
  };
}

export function annotateGardenSignalPools({
  poolAddresses,
  typedHypercertPoolAddress,
  gardenAddress,
  communityAddress,
}: AnnotateGardenSignalPoolsInput): GardenSignalPool[] {
  const normalizedTypedHypercertPool = normalizeNonZeroAddress(typedHypercertPoolAddress);
  const normalizedGarden = normalizeAddress(gardenAddress) as Address;
  const normalizedCommunity = normalizeAddress(communityAddress) as Address;

  return poolAddresses.map((poolAddress) => {
    const normalizedPool = normalizeAddress(poolAddress) as Address;
    const isTypedHypercertPool = compareAddresses(normalizedPool, normalizedTypedHypercertPool);

    return {
      poolAddress: normalizedPool,
      poolType: isTypedHypercertPool ? PoolType.Hypercert : PoolType.Action,
      gardenAddress: normalizedGarden,
      communityAddress: normalizedCommunity,
    };
  });
}
