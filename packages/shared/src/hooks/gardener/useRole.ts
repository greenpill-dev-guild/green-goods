import { graphql } from "gql.tada";
import { useQuery } from "urql";
import { useAccount } from "wagmi";
import { useAuthContext } from "../../providers/Auth";
import { useDeploymentRegistry } from "../blockchain/useDeploymentRegistry";

const GET_OPERATOR_GARDENS = graphql(`
  query GetOperatorGardens($operator: [String!]!) {
    Garden(where: {operators: {_contains: $operator}}) {
      id
      name
    }
  }
`);

export type UserRole = "deployer" | "operator" | "user";

export interface RoleInfo {
  role: UserRole;
  isDeployer: boolean;
  isOperator: boolean;
  operatorGardens: Array<{ id: string; name: string }>;
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

  const [{ data: operatorData, fetching }] = useQuery({
    query: GET_OPERATOR_GARDENS,
    variables: { operator: [address ?? ""] },
    pause: !address || !ready,
  });

  const operatorGardens = operatorData?.Garden || [];
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
    loading: !ready || fetching || deploymentRegistry.loading,
    deploymentPermissions: {
      canDeploy: deploymentRegistry.canDeploy,
      isOwner: deploymentRegistry.isOwner,
      isInAllowlist: deploymentRegistry.isInAllowlist,
    },
  };
}
