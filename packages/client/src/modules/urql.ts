import { Client, cacheExchange, fetchExchange } from "@urql/core";

export const greenGoodsIndexer = new Client({
  url: import.meta.env.DEV
    ? "http://localhost:8080/v1/graphql"
    : import.meta.env.VITE_ENVIO_INDEXER_URL ||
      "https://indexer.hypersync.xyz/4e02df79-f0c7-498a-9df6-8a4a1c9c8dd4",
  exchanges: [cacheExchange, fetchExchange],
});

export const easArbitrumClient = new Client({
  url: "https://arbitrum.easscan.org/graphql",
  exchanges: [cacheExchange, fetchExchange],
});
