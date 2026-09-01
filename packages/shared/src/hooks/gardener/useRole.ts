import type { Address } from "../../types/domain";
import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "../../config/react-query";
import { logger } from "../../modules/app/logger";
import { greenGoodsGraphQL } from "../../modules/data/graphql";
import { greenGoodsIndexer } from "../../modules/data/graphql-client";
import { useAuthContext } from "../../providers/Auth";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useDeploymentRegistry } from "../blockchain/useDeploymentRegistry";
import { roleKeys } from "../../config/query-keys/identity";

const GET_STEWARD_GARDENS = greenGoodsGraphQL(/* GraphQL */ `
  query GetStewardGardens($steward: [String!]!, $chainId: Int!) {
    Garden(
      where: {
        chainId: { _eq: $chainId }
        _or: [{operators: {_contains: $steward}}, {owners: {_contains: $steward}}]
      }
    ) {
      id
      name
    }
  }
`);

interface StewardGarden {
  id: string;
  name: string;
}

/**
 * Fetches gardens where the given address is a steward
 * (the indexer still spells the membership field `operators`)
 */
async function fetchStewardGardens(address: string, chainId: number): Promise<StewardGarden[]> {
  const { data, error } = await greenGoodsIndexer.query(
    GET_STEWARD_GARDENS,
    { steward: [address.toLowerCase()], chainId },
    "getStewardGardens"
  );

  if (error) {
    // Surface the outage to React Query (isError) instead of masking it as an
    // empty list — a failed fetch and a genuine empty result must stay
    // distinguishable so the admin can show a retry state, not "no access".
    logger.error("Failed to fetch steward gardens", { source: "useRole", error: error.message });
    throw error;
  }

  return data?.Garden ?? [];
}

export type UserRole = "deployer" | "steward" | "user";

export interface RoleInfo {
  role: UserRole;
  isDeployer: boolean;
  isSteward: boolean;
  stewardGardens: StewardGarden[];
  loading: boolean;
  /**
   * True when the steward-gardens indexer query failed (network/indexer
   * outage), as opposed to a successful query that genuinely returned none.
   * Lets the admin distinguish a retryable error from real "no access".
   */
  gardensError: boolean;
  deploymentPermissions: {
    canDeploy: boolean;
    isOwner: boolean;
    isInAllowlist: boolean;
  };
}

export function useRole(): RoleInfo {
  const auth = useAuthContext();
  const chainId = useCurrentChain();

  // Single source of truth for the user's address — matches the rule every other
  // admin hook (useEligibleAdminGardens, useGardenPermissions, useEffectiveToolbarPermissions)
  // already follows. Without this, an attached wagmi EOA could outrank the
  // authenticated smart account and produce zero steward gardens despite a
  // valid on-chain role grant.
  const address = usePrimaryAddress();
  const normalizedAddress = address?.toLowerCase() as Address | undefined;

  const ready = auth.isReady;

  const deploymentRegistry = useDeploymentRegistry();

  // Use React Query for fetching steward gardens
  const {
    data: stewardGardens = [],
    isLoading: isFetching,
    isError: gardensError,
  } = useQuery({
    queryKey: roleKeys.stewardGardens(normalizedAddress ?? undefined, chainId),
    queryFn: () => fetchStewardGardens(normalizedAddress!, chainId),
    enabled: !!normalizedAddress && ready,
    staleTime: STALE_TIMES.baseLists,
    // Offline-first: prefer cached data
    networkMode: "offlineFirst",
  });

  const isSteward = stewardGardens.length > 0;
  const isDeployer = deploymentRegistry.canDeploy;

  // Determine primary role based on capabilities
  let role: UserRole = "user";
  if (isDeployer) {
    role = "deployer";
  } else if (isSteward) {
    role = "steward";
  }

  return {
    role,
    isDeployer,
    isSteward,
    stewardGardens,
    loading: !ready || isFetching || deploymentRegistry.loading,
    gardensError,
    deploymentPermissions: {
      canDeploy: deploymentRegistry.canDeploy,
      isOwner: deploymentRegistry.isOwner,
      isInAllowlist: deploymentRegistry.isInAllowlist,
    },
  };
}
