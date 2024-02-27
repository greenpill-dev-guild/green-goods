import { Client, cacheExchange, fetchExchange } from "@urql/core";

export const client = new Client({
  url: "http://localhost:8020/graphql",
  exchanges: [cacheExchange, fetchExchange],
});
