import { useQuery } from "urql";
import { useUser } from "@/providers/user";
import { ADMIN_ALLOWLIST } from "@/config";
import { graphql } from "gql.tada";

const GET_OPERATOR_GARDENS = graphql(`
  query GetOperatorGardens($operator: String!) {
    gardens(where: { operators_contains: [$operator] }) {
      id
      name
    }
  }
`);

export type UserRole = "admin" | "operator" | "unauthorized";

export interface RoleInfo {
  role: UserRole;
  isAdmin: boolean;
  isOperator: boolean;
  operatorGardens: Array<{ id: string; name: string }>;
  loading: boolean;
}

export function useRole(): RoleInfo {
  const { address, ready } = useUser();
  
  const [{ data: operatorData, fetching }] = useQuery({
    query: GET_OPERATOR_GARDENS,
    variables: { operator: address || "" },
    pause: !address || !ready,
  });

  const isAdmin = address ? ADMIN_ALLOWLIST.map(addr => addr.toLowerCase()).includes(address.toLowerCase()) : false;
  const operatorGardens = operatorData?.gardens || [];
  const isOperator = operatorGardens.length > 0;
  
  let role: UserRole = "unauthorized";
  if (isAdmin) {
    role = "admin";
  } else if (isOperator) {
    role = "operator";
  }

  return {
    role,
    isAdmin,
    isOperator,
    operatorGardens,
    loading: !ready || fetching,
  };
}