import type { Enum, Garden, GardenVault, Hypercert } from "envio";

import { normalizeAddress } from "./addresses";
import { getGardenVaultId } from "./ids";

type HypercertStatus = Enum<"HypercertStatus">;

export function createDefaultGarden(gardenId: string, chainId: number, timestamp: number): Garden {
  return {
    id: gardenId,
    chainId,
    tokenAddress: "",
    tokenID: 0n,
    name: "",
    description: "",
    location: "",
    bannerImage: "",
    openJoining: false,
    initialized: false,
    gardeners: [],
    operators: [],
    evaluators: [],
    owners: [],
    funders: [],
    communities: [],
    createdAt: timestamp,
    gapProjectUID: undefined,
    karmaProjectState: "UNKNOWN",
    karmaProjectReason: undefined,
    karmaProjectUpdatedAt: undefined,
    karmaDetailsState: "UNKNOWN",
    karmaDetailsReason: undefined,
    karmaDetailsUpdatedAt: undefined,
    karmaMembershipState: "UNKNOWN",
    karmaMembershipReason: undefined,
    karmaMembershipUpdatedAt: undefined,
    karmaAccessState: "UNKNOWN",
    karmaAccessReason: undefined,
    karmaAccessUpdatedAt: undefined,
    karmaProjectUpdateState: "UNKNOWN",
    karmaProjectUpdateReason: undefined,
    karmaProjectUpdateUpdatedAt: undefined,
    karmaMembershipPendingAccounts: [],
    karmaMembershipFailedAccounts: [],
    karmaAccessPendingAccounts: [],
    karmaAccessFailedAccounts: [],
    karmaLastFailureReason: undefined,
    karmaLastSyncAt: undefined,
  };
}

export function createDefaultGardenVault(
  chainId: number,
  garden: string,
  asset: string,
  vaultAddress: string,
  timestamp: number
): GardenVault {
  return {
    id: getGardenVaultId(chainId, garden, asset),
    chainId,
    garden: normalizeAddress(garden),
    asset: normalizeAddress(asset),
    vaultAddress: normalizeAddress(vaultAddress),
    totalDeposited: 0n,
    totalWithdrawn: 0n,
    totalHarvestCount: 0,
    donationAddress: undefined,
    depositorCount: 0,
    paused: false,
    createdAt: timestamp,
  };
}

export function createDefaultHypercert(
  hypercertId: string,
  chainId: number,
  tokenId: bigint,
  timestamp: number
): Hypercert {
  return {
    id: hypercertId,
    chainId,
    tokenId,
    garden: "",
    metadataUri: "",
    mintedAt: timestamp,
    mintedBy: "",
    txHash: "",
    totalUnits: 0n,
    claimedUnits: 0n,
    attestationCount: 0,
    attestationUIDs: [],
    bundleKind: "WORK_LEGACY",
    metadataReconciliationRequired: false,
    commitmentIds: [],
    commitmentEntityIds: [],
    needUIDs: [],
    status: "ACTIVE" as HypercertStatus,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
