import type { Abi } from "viem";

import type { Address, Garden } from "../../types/domain";
import {
  KARMA_REQUIRED_SYNC_VERSION,
  type KarmaIntegrationProjection,
  type KarmaIntegrationStatus,
} from "../../types/karma";
import {
  isValidAddressFormat,
  isZeroAddress,
  normalizeAddress,
} from "../../utils/blockchain/address";

export const KARMA_SYNC_VERSION = KARMA_REQUIRED_SYNC_VERSION;
export const KARMA_CHAIN_ID = 42161;

export const KARMA_ACCOUNT_READ_ABI = [
  {
    type: "function",
    name: "karmaSyncVersion",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "slug",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const satisfies Abi;

export const KARMA_MODULE_ABI = [
  {
    type: "function",
    name: "reconcileProject",
    stateMutability: "nonpayable",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "projectUID", type: "bytes32" }],
  },
  {
    type: "function",
    name: "reconcileProjectAccess",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "account", type: "address" },
    ],
    outputs: [
      { name: "roleActive", type: "bool" },
      { name: "changed", type: "bool" },
    ],
  },
] as const satisfies Abi;

export const EMPTY_KARMA_PROJECTION: KarmaIntegrationProjection = {
  projectUID: null,
  projectState: "unknown",
  projectReason: null,
  detailsState: "unknown",
  detailsReason: null,
  membershipState: "unknown",
  membershipReason: null,
  accessState: "unknown",
  accessReason: null,
  projectUpdateState: "unknown",
  projectUpdateReason: null,
  membershipPendingAccounts: [],
  membershipFailedAccounts: [],
  accessPendingAccounts: [],
  accessFailedAccounts: [],
  lastFailureReason: null,
  lastSyncAt: null,
};

export interface KarmaIntegrationDerivationInput {
  chainId: number;
  gardenAddress: Address;
  gardenSlug?: string | null;
  supported: boolean;
  syncVersion: number | null;
  readErrorReason?: string | null;
  isRetrying: boolean;
  projection: KarmaIntegrationProjection;
}

export interface KarmaIntegrationAuthorizationInput {
  primaryAddress: Address | null;
  owners: readonly Address[];
  stewards: readonly Address[];
}

export interface KarmaIntegrationAuthorization {
  canReconcile: boolean;
}

function projectedFailureReason(projection: KarmaIntegrationProjection): string | null {
  if (projection.projectState === "failed") return projection.projectReason;
  if (projection.detailsState === "failed") return projection.detailsReason;
  if (projection.membershipState === "failed") return projection.membershipReason;
  if (projection.accessState === "failed") return projection.accessReason;
  if (projection.projectUpdateState === "failed") return projection.projectUpdateReason;
  return projection.lastFailureReason;
}

export function deriveKarmaIntegrationStatus(
  input: KarmaIntegrationDerivationInput
): KarmaIntegrationStatus {
  const gardenSlug = input.gardenSlug?.trim();
  const profileUrl =
    input.projection.projectUID && gardenSlug
      ? `https://www.karmahq.org/project/${encodeURIComponent(gardenSlug)}`
      : null;
  const base = {
    chainId: input.chainId,
    gardenAddress: input.gardenAddress,
    projectUID: input.projection.projectUID,
    profileUrl,
    syncVersion: input.syncVersion,
    requiredSyncVersion: KARMA_SYNC_VERSION,
  } as const;

  if (!input.supported) {
    return { ...base, status: "unsupported", reason: "chain_not_supported" };
  }
  if (input.readErrorReason) {
    return { ...base, status: "failed", reason: input.readErrorReason };
  }
  if (input.syncVersion === null || input.syncVersion < KARMA_SYNC_VERSION) {
    return { ...base, status: "upgrade-needed", reason: "legacy_garden_account" };
  }
  if (input.isRetrying) {
    return { ...base, status: "retrying", reason: null };
  }
  if (!input.projection.projectUID) {
    return { ...base, status: "no-project", reason: input.projection.projectReason };
  }

  const failureReason = projectedFailureReason(input.projection);
  if (
    input.projection.projectState === "failed" ||
    input.projection.detailsState === "failed" ||
    input.projection.membershipState === "failed" ||
    input.projection.accessState === "failed" ||
    input.projection.projectUpdateState === "failed" ||
    input.projection.membershipFailedAccounts.length > 0 ||
    input.projection.accessFailedAccounts.length > 0
  ) {
    return { ...base, status: "failed", reason: failureReason };
  }
  if (input.projection.detailsState === "pending" || input.projection.detailsState === "unknown") {
    return { ...base, status: "stale-details", reason: input.projection.detailsReason };
  }
  if (
    input.projection.membershipState === "pending" ||
    input.projection.membershipState === "unknown" ||
    input.projection.accessState === "pending" ||
    input.projection.accessState === "unknown" ||
    input.projection.membershipPendingAccounts.length > 0 ||
    input.projection.accessPendingAccounts.length > 0
  ) {
    return {
      ...base,
      status: "access-pending",
      reason: input.projection.accessReason ?? input.projection.membershipReason,
    };
  }

  return { ...base, status: "synced", reason: null };
}

export function isMissingKarmaVersionSelector(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return /returned no data|function selector was not recognized|function does not exist/i.test(
    message
  );
}

export function deriveKarmaIntegrationAuthorization(
  input: KarmaIntegrationAuthorizationInput
): KarmaIntegrationAuthorization {
  const normalizedPrimary = input.primaryAddress ? normalizeAddress(input.primaryAddress) : null;
  const canReconcile = Boolean(
    normalizedPrimary &&
      [...input.owners, ...input.stewards].some(
        (account) => normalizeAddress(account) === normalizedPrimary
      )
  );
  return { canReconcile };
}

export function uniqueKarmaReconciliationAccounts(
  garden: Garden,
  projection: KarmaIntegrationProjection
): Address[] {
  const accounts = [
    ...garden.owners,
    ...garden.stewards,
    ...projection.membershipPendingAccounts,
    ...projection.membershipFailedAccounts,
    ...projection.accessPendingAccounts,
    ...projection.accessFailedAccounts,
  ];
  return Array.from(
    new Set(
      accounts
        .filter((account) => isValidAddressFormat(account) && !isZeroAddress(account))
        .map((account) => normalizeAddress(account) as Address)
    )
  );
}
