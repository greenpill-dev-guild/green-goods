import { Client, cacheExchange, fetchExchange } from "@urql/core";

export const greenGoodsIndexer = new Client({
  url: import.meta.env.VITE_ENVIO_INDEXER_URL,
  exchanges: [cacheExchange, fetchExchange],
});

export const easArbitrumClient = new Client({
  url: "https://arbitrum.easscan.org/graphql",
  exchanges: [cacheExchange, fetchExchange],
});
