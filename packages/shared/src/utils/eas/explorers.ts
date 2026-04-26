/** EAS attestation explorer + block explorer URL helpers. */

import { getBlockExplorer, getEASName } from "../blockchain/chain-registry";

export function getEASExplorerUrl(chainId: number, attestationId: string): string {
  const chainName = getEASName(chainId);
  // Mainnet uses the bare easscan.org domain; other chains use a subdomain.
  if (chainName === "mainnet") {
    return `https://easscan.org/attestation/view/${attestationId}`;
  }
  return `https://${chainName}.easscan.org/attestation/view/${attestationId}`;
}

export function openEASExplorer(chainId: number, attestationId: string): void {
  const url = getEASExplorerUrl(chainId, attestationId);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function isValidAttestationId(attestationId: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(attestationId);
}

export function getBlockExplorerTxUrl(chainId: number, txHash: string): string {
  const baseUrl = getBlockExplorer(chainId);
  return `${baseUrl}/tx/${txHash}`;
}

export function openBlockExplorerTx(chainId: number, txHash: string): void {
  const url = getBlockExplorerTxUrl(chainId, txHash);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function getBlockExplorerAddressUrl(chainId: number, address: string): string {
  const baseUrl = getBlockExplorer(chainId);
  return `${baseUrl}/address/${address}`;
}

export function getBlockExplorerTokenUrl(chainId: number, tokenAddress: string): string {
  const baseUrl = getBlockExplorer(chainId);
  return `${baseUrl}/token/${tokenAddress}`;
}
