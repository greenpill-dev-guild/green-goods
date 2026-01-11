/**
 * Utility functions for EAS (Ethereum Attestation Service) explorer links
 * and block explorer transaction links
 */

/**
 * Maps chain IDs to their EAS explorer chain names
 */
const CHAIN_ID_TO_EAS_NAME: Record<number, string> = {
  1: "mainnet",
  11155111: "sepolia", // Sepolia testnet
  42161: "arbitrum-one",
  10: "optimism",
  137: "polygon",
  8453: "base",
  84532: "base-sepolia",
  // Add more chains as needed
};

/**
 * Maps chain IDs to their block explorer base URLs
 */
const CHAIN_ID_TO_BLOCK_EXPLORER: Record<number, string> = {
  1: "https://etherscan.io",
  11155111: "https://sepolia.etherscan.io",
  42161: "https://arbiscan.io",
  10: "https://optimistic.etherscan.io",
  137: "https://polygonscan.com",
  8453: "https://basescan.org",
  84532: "https://sepolia.basescan.org",
  42220: "https://celoscan.io",
  // Add more chains as needed
};

/**
 * Generates an EAS explorer URL for viewing an attestation
 * @param chainId - The chain ID where the attestation exists
 * @param attestationId - The attestation UID (0x prefixed hex string)
 * @returns The complete EAS explorer URL
 */
export function getEASExplorerUrl(chainId: number, attestationId: string): string {
  const chainName = CHAIN_ID_TO_EAS_NAME[chainId];

  if (!chainName) {
    // Fallback to mainnet for unknown chain IDs
    return `https://easscan.org/attestation/view/${attestationId}`;
  }

  // For mainnet, use the base domain without subdomain
  if (chainName === "mainnet") {
    return `https://easscan.org/attestation/view/${attestationId}`;
  }

  // For other chains, use subdomain format
  return `https://${chainName}.easscan.org/attestation/view/${attestationId}`;
}

/**
 * Opens the EAS explorer in a new tab
 * @param chainId - The chain ID where the attestation exists
 * @param attestationId - The attestation UID
 */
export function openEASExplorer(chainId: number, attestationId: string): void {
  const url = getEASExplorerUrl(chainId, attestationId);
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Checks if an attestation ID is valid (0x prefixed hex string)
 * @param attestationId - The attestation ID to validate
 * @returns True if valid, false otherwise
 */
export function isValidAttestationId(attestationId: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(attestationId);
}

/**
 * Generates a block explorer URL for viewing a transaction
 * @param chainId - The chain ID where the transaction exists
 * @param txHash - The transaction hash (0x prefixed hex string)
 * @returns The complete block explorer URL
 */
export function getBlockExplorerTxUrl(chainId: number, txHash: string): string {
  const baseUrl = CHAIN_ID_TO_BLOCK_EXPLORER[chainId];

  if (!baseUrl) {
    // Fallback to etherscan mainnet for unknown chain IDs
    return `https://etherscan.io/tx/${txHash}`;
  }

  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Opens the block explorer transaction page in a new tab
 * @param chainId - The chain ID where the transaction exists
 * @param txHash - The transaction hash
 */
export function openBlockExplorerTx(chainId: number, txHash: string): void {
  const url = getBlockExplorerTxUrl(chainId, txHash);
  window.open(url, "_blank", "noopener,noreferrer");
}
