import { createClient, cacheExchange, fetchExchange, errorExchange } from "urql";
import { INDEXER_URL } from "@/config";

export const urqlClient = createClient({
  url: INDEXER_URL,
  exchanges: [
    errorExchange({
      onError: (error) => {
        console.error("GraphQL Error:", error);
        // You could add toast notifications here if needed
      },
    }),
    cacheExchange,
    fetchExchange,
  ],
  fetchOptions: () => {
    return {
      headers: {
        "Content-Type": "application/json",
      },
    };
  },
});
