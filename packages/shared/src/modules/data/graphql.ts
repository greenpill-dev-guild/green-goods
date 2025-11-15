import { initGraphQLTada } from "gql.tada";
import type { introspection } from "../../types/eas";
import type { introspection as greenGoodsIntrospection } from "../../types/green-goods";

/** Tagged template for EAS GraphQL queries with type safety */
export const easGraphQL = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    BigInt: string;
  };
}>();

/** Tagged template for Green Goods indexer GraphQL queries with type safety */
export const greenGoodsGraphQL = initGraphQLTada<{
  introspection: greenGoodsIntrospection;
  scalars: {
    BigInt: string;
    numeric: string;
    timestamp: string;
    timestamptz: string;
    capital: string;
    contract_type: string;
    jsonb: string;
  };
}>();

export type { FragmentOf, ResultOf, VariablesOf } from "gql.tada";
