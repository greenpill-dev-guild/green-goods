import { useQuery } from "urql";
import { useAuth } from "@/providers/AuthProvider";
import { useDeploymentRegistry } from "./useDeploymentRegistry";
import { graphql } from "gql.tada";

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
  const { address, ready } = useAuth();
  const deploymentRegistry = useDeploymentRegistry();
  
  const [{ data: operatorData, fetching }] = useQuery({
    query: GET_OPERATOR_GARDENS,
    variables: { operator: [address || ""] },
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