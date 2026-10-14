import {
  indexer,
  type Enum,
  type Garden,
  type GardenVault,
  type Hypercert,
  type KarmaProjectAccess,
} from "envio";
import type { Address } from "viem";

import { normalizeAddress } from "./addresses";
import { getGardenVaultId, getKarmaProjectAccessId } from "./ids";

type HypercertStatus = Enum<"HypercertStatus">;
export type EventContext = Parameters<Parameters<typeof indexer.onEvent>[1]>[0]["context"];

export function createDefaultKarmaProjectAccess(
  chainId: number,
  garden: Address,
  account: Address,
  projectUID?: string
): KarmaProjectAccess {
  return {
    id: getKarmaProjectAccessId(chainId, garden, account),
    chainId,
    garden: normalizeAddress(garden),
    account: normalizeAddress(account),
    projectUID,
    membershipState: "UNKNOWN",
    membershipOutcome: undefined,
    membershipReason: undefined,
    membershipUpdatedAt: undefined,
    accessState: "UNKNOWN",
    accessOutcome: undefined,
    accessReason: undefined,
    accessUpdatedAt: undefined,
  };
}

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
    karmaTrackedAccessAccounts: [],
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
