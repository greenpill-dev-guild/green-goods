export const INDEXER_ENDPOINT = "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql";

export const EAS_GRAPHQL_ENDPOINTS: Record<number, string> = {
  42161: "https://arbitrum.easscan.org/graphql",
  42220: "https://celo.easscan.org/graphql",
  11155111: "https://sepolia.easscan.org/graphql",
};

export const EAS_EXPLORER_ENDPOINTS: Record<number, string> = {
  42161: "https://arbitrum.easscan.org",
  42220: "https://celo.easscan.org",
  11155111: "https://sepolia.easscan.org",
};
