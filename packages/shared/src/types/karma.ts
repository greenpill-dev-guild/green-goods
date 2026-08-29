import type { Hex } from "viem";

import type { Address } from "./domain";

export const KARMA_REQUIRED_SYNC_VERSION = 1 as const;

export type KarmaProjectionState = "unknown" | "pending" | "synced" | "failed";

export interface KarmaIntegrationProjection {
  projectUID: Hex | null;
  projectState: KarmaProjectionState;
  projectReason: string | null;
  detailsState: KarmaProjectionState;
  detailsReason: string | null;
  membershipState: KarmaProjectionState;
  membershipReason: string | null;
  accessState: KarmaProjectionState;
  accessReason: string | null;
  projectUpdateState: KarmaProjectionState;
  projectUpdateReason: string | null;
  membershipPendingAccounts: Address[];
  membershipFailedAccounts: Address[];
  accessPendingAccounts: Address[];
  accessFailedAccounts: Address[];
  lastFailureReason: string | null;
  lastSyncAt: number | null;
}

export type KarmaIntegrationStatusName =
  | "unsupported"
  | "upgrade-needed"
  | "no-project"
  | "stale-details"
  | "access-pending"
  | "failed"
  | "retrying"
  | "synced";

interface KarmaIntegrationStatusBase {
  chainId: number;
  gardenAddress: Address;
  projectUID: Hex | null;
  profileUrl: string | null;
  syncVersion: number | null;
  requiredSyncVersion: typeof KARMA_REQUIRED_SYNC_VERSION;
  reason: string | null;
}

export type KarmaIntegrationStatus = {
  [Status in KarmaIntegrationStatusName]: KarmaIntegrationStatusBase & { status: Status };
}[KarmaIntegrationStatusName];
