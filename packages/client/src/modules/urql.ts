import { Client, cacheExchange, fetchExchange } from "@urql/core";

// Dynamically determine indexer URL based on environment
function getIndexerUrl() {
  // If explicitly set, use that
  if (import.meta.env.VITE_ENVIO_INDEXER_URL) {
    return import.meta.env.VITE_ENVIO_INDEXER_URL;
  }

  // Default to local development URL
  const isDev = import.meta.env.DEV;
  const isLocalhost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (isDev || isLocalhost) {
    return "http://localhost:8080/graphql";
  }

  // Production URL (update when deployed)
  return "https://api.greengoods.app/indexer";
}

// Get EAS GraphQL URL based on chain
function getEasGraphqlUrl(chainId?: number | string) {
  const chain = chainId ? String(chainId) : import.meta.env.VITE_CHAIN_ID || "84532";

  switch (chain) {
    case "42161":
      return "https://arbitrum.easscan.org/graphql";
    case "42220":
      return "https://celo.easscan.org/graphql";
    case "84532":
      return "https://base-sepolia.easscan.org/graphql";
    default:
      return "https://base-sepolia.easscan.org/graphql";
  }
}

// Create EAS client for a specific chain
export function createEasClient(chainId?: number | string) {
  return new Client({
    url: getEasGraphqlUrl(chainId),
    exchanges: [cacheExchange, fetchExchange],
  });
}

export const greenGoodsIndexer = new Client({
  url: getIndexerUrl(),
  exchanges: [cacheExchange, fetchExchange],
});

export const easClient = new Client({
  url: getEasGraphqlUrl(),
  exchanges: [cacheExchange, fetchExchange],
});
