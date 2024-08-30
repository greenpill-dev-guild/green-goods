import { Client, cacheExchange, fetchExchange } from "@urql/core";

export const greenGoodsIndexer = new Client({
  url:
    import.meta.env.DEV ?
      "http://localhost:8000"
    : "https://green-goods-indever.herokuapp.com",
  exchanges: [cacheExchange, fetchExchange],
});

export const easArbitrumClient = new Client({
  url: "https://arbitrum.easscan.org/graphql",
  exchanges: [cacheExchange, fetchExchange],
});
