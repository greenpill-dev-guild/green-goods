import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { STALE_TIMES } from "../../config/react-query";
import { greenGoodsGraphQL } from "../../modules/data/graphql";
import { greenGoodsIndexer } from "../../modules/data/graphql-client";
import { useAuthContext } from "../../providers/Auth";
import { queryKeys } from "../query-keys";
import { useDeploymentRegistry } from "../blockchain/useDeploymentRegistry";

const GET_OPERATOR_GARDENS = greenGoodsGraphQL(/* GraphQL */ `
  query GetOperatorGardens($operator: [String!]!) {
    Garden(where: {operators: {_contains: $operator}}) {
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
async function fetchOperatorGardens(address: string): Promise<OperatorGarden[]> {
  const { data, error } = await greenGoodsIndexer.query(
    GET_OPERATOR_GARDENS,
    { operator: [address] },
    "getOperatorGardens"
  );

  if (error) {
    console.error("[useRole] Failed to fetch operator gardens:", error.message);
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

  // Get address - prioritize wagmi for wallet mode, then auth context (wallet or passkey)
  const address = wagmiAddress ?? auth.walletAddress ?? auth.smartAccountAddress;

  // Ready when either wagmi is connected OR auth context is authenticated
  const ready = isConnected || (auth.isReady && auth.isAuthenticated);

  const deploymentRegistry = useDeploymentRegistry();

  // Use React Query for fetching operator gardens
  const { data: operatorGardens = [], isLoading: isFetching } = useQuery({
    queryKey: queryKeys.role.operatorGardens(address ?? undefined),
    queryFn: () => fetchOperatorGardens(address!),
    enabled: !!address && ready,
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
