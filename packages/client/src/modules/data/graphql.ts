import { initGraphQLTada } from "gql.tada";

import type { introspection as EASIntrospection } from "@/types/eas";
import type { introspection as GreenGoodsIntrospection } from "@/types/green-goods";

/** Strongly typed GraphQL clients for EAS and Green Goods backends. */

export const easGraphQL = initGraphQLTada<{
  introspection: EASIntrospection;
}>();

export const greenGoodsGraphQL = initGraphQLTada<{
  introspection: GreenGoodsIntrospection;
}>();
