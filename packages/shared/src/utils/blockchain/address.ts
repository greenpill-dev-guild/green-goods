/** Shared utilities for Ethereum address comparison and formatting. */

/**
 * Compare two Ethereum addresses (case-insensitive).
 *
 * @example
 * compareAddresses("0xABC...123", "0xabc...123") // true
 */
export function compareAddresses(
  a: string | undefined | null,
  b: string | undefined | null
): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * @example
 * const { user } = useUser();
 * isUserAddress(work.gardenerAddress, user?.id) // true/false
 */
export function isUserAddress(
  address: string | undefined | null,
  userAddress: string | undefined | null
): boolean {
  return compareAddresses(address, userAddress);
}

/**
 * @example
 * isAddressInList(userAddress, garden.operators) // true/false
 */
export function isAddressInList(
  address: string | undefined | null,
  list: string[] | undefined | null
): boolean {
  if (!address || !list || list.length === 0) return false;
  const normalized = address.toLowerCase();
  return list.some((item) => item.toLowerCase() === normalized);
}

/**
 * Truncate an Ethereum address for display.
 *
 * @example
 * truncateAddress("0x1234567890abcdef1234567890abcdef12345678")
 * // "0x1234...5678"
 */
export function truncateAddress(
  address: string | undefined | null,
  startChars = 6,
  endChars = 4
): string {
  if (!address) return "";
  if (address.length <= startChars + endChars + 3) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

// Two-overload shape preserves the Address type for `0x${string}` inputs.
export function normalizeAddress(address: `0x${string}`): `0x${string}`;
export function normalizeAddress(address: string | undefined | null): string;
export function normalizeAddress(address: string | undefined | null): string {
  if (!address) return "";
  return address.toLowerCase();
}

export function isValidAddressFormat(address: string | undefined | null): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/** The Ethereum zero address constant. */
export const ZERO_ADDRESS: `0x${string}` = "0x0000000000000000000000000000000000000000";

export function isZeroAddress(address: string | undefined | null): boolean {
  if (!address) return true;
  return address.toLowerCase() === ZERO_ADDRESS;
}
