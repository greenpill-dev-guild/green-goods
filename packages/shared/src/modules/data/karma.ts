import type { KarmaIntegrationProjection, KarmaProjectionState } from "../../types/karma";
import type { Address } from "../../types/domain";
import { greenGoodsGraphQL, type ResultOf } from "./graphql";
import { greenGoodsIndexer, type GraphQLReader } from "./graphql-client";

const KARMA_GARDEN_PROJECTION_QUERY = greenGoodsGraphQL(/* GraphQL */ `
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
`);

type KarmaGardenProjectionResponse = ResultOf<typeof KARMA_GARDEN_PROJECTION_QUERY>;
type KarmaGardenProjectionRow = KarmaGardenProjectionResponse["Garden"][number];

const ZERO_BYTES32 = /^0x0{64}$/i;

function parseProjectionState(value: string | null | undefined): KarmaProjectionState {
  const normalized = value?.toLowerCase();
  return normalized === "pending" || normalized === "synced" || normalized === "failed"
    ? normalized
    : "unknown";
}

function parseProjectUID(value: string | null | undefined): `0x${string}` | null {
  if (!value || ZERO_BYTES32.test(value) || !/^0x[0-9a-f]{64}$/i.test(value)) return null;
  return value as `0x${string}`;
}

function parseAddresses(values: readonly string[] | null | undefined): Address[] {
  return (values ?? []) as Address[];
}

function mapProjection(row?: KarmaGardenProjectionRow): KarmaIntegrationProjection {
  return {
    projectUID: parseProjectUID(row?.gapProjectUID),
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
    membershipPendingAccounts: parseAddresses(row?.karmaMembershipPendingAccounts),
    membershipFailedAccounts: parseAddresses(row?.karmaMembershipFailedAccounts),
    accessPendingAccounts: parseAddresses(row?.karmaAccessPendingAccounts),
    accessFailedAccounts: parseAddresses(row?.karmaAccessFailedAccounts),
    lastFailureReason: row?.karmaLastFailureReason ?? null,
    lastSyncAt: row?.karmaLastSyncAt ?? null,
  };
}

export async function getKarmaGardenProjection(
  gardenAddress: Address,
  chainId: number,
  reader: GraphQLReader = greenGoodsIndexer
): Promise<KarmaIntegrationProjection> {
  const { data, error } = await reader.query(
    KARMA_GARDEN_PROJECTION_QUERY,
    { gardenAddress, chainId },
    "getKarmaGardenProjection"
  );

  if (error) {
    throw error;
  }

  return mapProjection(data.Garden[0]);
}
