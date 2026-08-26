import { gql } from "graphql-request";

import type { KarmaIntegrationProjection, KarmaProjectionState } from "../../types/karma";
import type { Address } from "../../types/domain";
import { greenGoodsIndexer, type GraphQLReader } from "./graphql-client";

const KARMA_GARDEN_PROJECTION_QUERY = gql`
  query KarmaGardenProjection($gardenAddress: String!, $chainId: Int!) {
    Garden(
      where: { id: { _eq: $gardenAddress }, chainId: { _eq: $chainId } }
      limit: 1
    ) {
      gapProjectUID
      karmaProjectState
      karmaProjectReason
      karmaDetailsState
      karmaDetailsReason
      karmaMembershipState
      karmaMembershipReason
      karmaAccessState
      karmaAccessReason
      karmaProjectUpdateState
      karmaProjectUpdateReason
      karmaMembershipPendingAccounts
      karmaMembershipFailedAccounts
      karmaAccessPendingAccounts
      karmaAccessFailedAccounts
      karmaLastFailureReason
      karmaLastSyncAt
    }
  }
`;

interface KarmaGardenProjectionRow {
  gapProjectUID?: `0x${string}` | null;
  karmaProjectState?: string | null;
  karmaProjectReason?: string | null;
  karmaDetailsState?: string | null;
  karmaDetailsReason?: string | null;
  karmaMembershipState?: string | null;
  karmaMembershipReason?: string | null;
  karmaAccessState?: string | null;
  karmaAccessReason?: string | null;
  karmaProjectUpdateState?: string | null;
  karmaProjectUpdateReason?: string | null;
  karmaMembershipPendingAccounts?: Address[] | null;
  karmaMembershipFailedAccounts?: Address[] | null;
  karmaAccessPendingAccounts?: Address[] | null;
  karmaAccessFailedAccounts?: Address[] | null;
  karmaLastFailureReason?: string | null;
  karmaLastSyncAt?: number | null;
}

interface KarmaGardenProjectionResponse {
  Garden: KarmaGardenProjectionRow[];
}

const ZERO_BYTES32 = /^0x0{64}$/i;

function parseProjectionState(value: string | null | undefined): KarmaProjectionState {
  const normalized = value?.toLowerCase();
  return normalized === "pending" || normalized === "synced" || normalized === "failed"
    ? normalized
    : "unknown";
}

function mapProjection(row?: KarmaGardenProjectionRow): KarmaIntegrationProjection {
  const projectUID = row?.gapProjectUID;
  return {
    projectUID: projectUID && !ZERO_BYTES32.test(projectUID) ? projectUID : null,
    projectState: parseProjectionState(row?.karmaProjectState),
    projectReason: row?.karmaProjectReason ?? null,
    detailsState: parseProjectionState(row?.karmaDetailsState),
    detailsReason: row?.karmaDetailsReason ?? null,
    membershipState: parseProjectionState(row?.karmaMembershipState),
    membershipReason: row?.karmaMembershipReason ?? null,
    accessState: parseProjectionState(row?.karmaAccessState),
    accessReason: row?.karmaAccessReason ?? null,
    projectUpdateState: parseProjectionState(row?.karmaProjectUpdateState),
    projectUpdateReason: row?.karmaProjectUpdateReason ?? null,
    membershipPendingAccounts: row?.karmaMembershipPendingAccounts ?? [],
    membershipFailedAccounts: row?.karmaMembershipFailedAccounts ?? [],
    accessPendingAccounts: row?.karmaAccessPendingAccounts ?? [],
    accessFailedAccounts: row?.karmaAccessFailedAccounts ?? [],
    lastFailureReason: row?.karmaLastFailureReason ?? null,
    lastSyncAt: row?.karmaLastSyncAt ?? null,
  };
}

export async function getKarmaGardenProjection(
  gardenAddress: Address,
  chainId: number,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<KarmaIntegrationProjection> {
  const { data, error } = await reader.query<KarmaGardenProjectionResponse>(
    KARMA_GARDEN_PROJECTION_QUERY,
    { gardenAddress, chainId },
    "getKarmaGardenProjection"
  );

  if (error) {
    throw error;
  }

  return mapProjection(data.Garden[0]);
}
