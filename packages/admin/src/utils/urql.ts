import { createClient, cacheExchange, fetchExchange } from "urql";
import { INDEXER_URL } from "@/config";

export const urqlClient = createClient({
  url: INDEXER_URL,
  exchanges: [
    cacheExchange,
    fetchExchange,
  ],
});