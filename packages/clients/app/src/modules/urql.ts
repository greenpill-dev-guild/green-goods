import { Client, cacheExchange, fetchExchange } from "urql";

export const graphClient = new Client({
  url:
    import.meta.env.GRAPH_URL ??
    "http://localhost:8000/subgraphs/name/graph-name-here",
  exchanges: [cacheExchange, fetchExchange],
});
