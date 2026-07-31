/**
 * Handler Utilities
 *
 * NOTE: formatAddress is intentionally a local implementation matching @green-goods/shared
 * behavior to avoid pulling in browser-only dependencies in the Node.js agent environment.
 * The shared package relies on browser APIs (import.meta.env, etc.) that are unavailable here.
 */

/**
 * Format an Ethereum address for display.
 * Uses the same default behavior as @green-goods/shared formatAddress.
 */
export function formatAddress(address: string): string {
  if (!address || address.length <= 10) return address || "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
