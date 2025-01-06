import { Client, cacheExchange, fetchExchange } from "@urql/core";

export const greenGoodsIndexer = new Client({
  url: "https://indexer.dev.hyperindex.xyz/80e789b/v1/graphql",
  exchanges: [cacheExchange, fetchExchange],
});

export const easArbitrumClient = new Client({
  url: "https://arbitrum.easscan.org/graphql",
  exchanges: [cacheExchange, fetchExchange],
});
