import { initGraphQLTada } from "gql.tada";

import type { introspection as GreenGoodsIntrospection } from "../types/green-goods";
import type { introspection as EASIntrospection } from "../types/eas";

export const greenGoodsGraphQL = initGraphQLTada<{
  introspection: GreenGoodsIntrospection;
}>();

export const easGraphQL = initGraphQLTada<{
  introspection: EASIntrospection;
}>();
