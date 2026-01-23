/**
 * Utility functions for EAS (Ethereum Attestation Service) explorer links
 * and block explorer transaction links
 */

import { getBlockExplorer, getEASName } from "../blockchain/chain-registry";

/**
 * Generates an EAS explorer URL for viewing an attestation
 * @param chainId - The chain ID where the attestation exists
 * @param attestationId - The attestation UID (0x prefixed hex string)
 * @returns The complete EAS explorer URL
 */
export function getEASExplorerUrl(chainId: number, attestationId: string): string {
  const chainName = getEASName(chainId);

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
  const baseUrl = getBlockExplorer(chainId);
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
