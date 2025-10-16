import { initGraphQLTada } from "gql.tada";

import type { introspection as EASIntrospection } from "@/types/eas";

export const easGraphQL = initGraphQLTada<{
  introspection: EASIntrospection;
}>();
