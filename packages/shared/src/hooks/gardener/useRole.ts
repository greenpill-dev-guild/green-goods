import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { STALE_TIMES } from "../../config/react-query";
import { greenGoodsGraphQL } from "../../modules/data/graphql";
import { greenGoodsIndexer } from "../../modules/data/graphql-client";
import { logger } from "../../modules/app/logger";
import { useAuthContext } from "../../providers/Auth";
import { queryKeys } from "../query-keys";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useDeploymentRegistry } from "../blockchain/useDeploymentRegistry";

const GET_OPERATOR_GARDENS = greenGoodsGraphQL(/* GraphQL */ `
  query GetOperatorGardens($operator: [String!]!, $chainId: Int!) {
    Garden(
      where: {
        chainId: { _eq: $chainId }
        _or: [{operators: {_contains: $operator}}, {owners: {_contains: $operator}}]
      }
    ) {
      id
      name
    }
  }
`);

interface OperatorGarden {
  id: string;
  name: string;
}

/**
 * Fetches gardens where the given address is an operator
 */
async function fetchOperatorGardens(address: string, chainId: number): Promise<OperatorGarden[]> {
  const { data, error } = await greenGoodsIndexer.query(
    GET_OPERATOR_GARDENS,
    { operator: [address.toLowerCase()], chainId },
    "getOperatorGardens"
  );

  if (error) {
    logger.error("Failed to fetch operator gardens", { source: "useRole", error: error.message });
    return [];
  }

  return data?.Garden ?? [];
}

export type UserRole = "deployer" | "operator" | "user";

export interface RoleInfo {
  role: UserRole;
  isDeployer: boolean;
  isOperator: boolean;
  operatorGardens: OperatorGarden[];
  loading: boolean;
  deploymentPermissions: {
    canDeploy: boolean;
    isOwner: boolean;
    isInAllowlist: boolean;
  };
}

export function useRole(): RoleInfo {
  const auth = useAuthContext();
  const { address: wagmiAddress, isConnected } = useAccount();
  const chainId = useCurrentChain();

  // Get address - prioritize wagmi for wallet mode, then auth context (wallet or passkey)
  const address = wagmiAddress ?? auth.walletAddress ?? auth.smartAccountAddress;
  const normalizedAddress = address?.toLowerCase();

  // Ready when either wagmi is connected OR auth context is authenticated
  const ready = isConnected || (auth.isReady && auth.isAuthenticated);

  const deploymentRegistry = useDeploymentRegistry();

  // Use React Query for fetching operator gardens
  const { data: operatorGardens = [], isLoading: isFetching } = useQuery({
    queryKey: queryKeys.role.operatorGardens(normalizedAddress ?? undefined, chainId),
    queryFn: () => fetchOperatorGardens(normalizedAddress!, chainId),
    enabled: !!normalizedAddress && ready,
    staleTime: STALE_TIMES.baseLists,
    // Offline-first: prefer cached data
    networkMode: "offlineFirst",
  });

  const isOperator = operatorGardens.length > 0;
  const isDeployer = deploymentRegistry.canDeploy;

  // Determine primary role based on capabilities
  let role: UserRole = "user";
  if (isDeployer) {
    role = "deployer";
  } else if (isOperator) {
    role = "operator";
  }

  return {
    role,
    isDeployer,
    isOperator,
    operatorGardens,
    loading: !ready || isFetching || deploymentRegistry.loading,
    deploymentPermissions: {
      canDeploy: deploymentRegistry.canDeploy,
      isOwner: deploymentRegistry.isOwner,
      isInAllowlist: deploymentRegistry.isInAllowlist,
    },
  };
}
