/**
 * Handler utility functions
 */

/**
 * Formats an Ethereum address for display.
 */
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Formats a rate limit wait time for display.
 */
export function formatWaitTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}
