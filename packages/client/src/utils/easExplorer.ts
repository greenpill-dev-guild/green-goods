/**
 * Utility functions for EAS (Ethereum Attestation Service) explorer links
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
    console.warn(`Unknown chain ID for EAS explorer: ${chainId}`);
    // Fallback to mainnet
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
