/**
 * Address Utilities
 *
 * Shared utilities for Ethereum address comparison and formatting.
 */

/**
 * Compare two Ethereum addresses (case-insensitive)
 *
 * @param a - First address
 * @param b - Second address
 * @returns true if addresses are equal (case-insensitive)
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
 * Check if an address matches the current user's address
 *
 * @param address - Address to check
 * @param userAddress - Current user's address
 * @returns true if the address belongs to the current user
 *
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
 * Check if an address is in a list of addresses (case-insensitive)
 *
 * @param address - Address to find
 * @param list - List of addresses to search
 * @returns true if address is found in the list
 *
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
 * Truncate an Ethereum address for display
 *
 * @param address - Full address
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address like "0x1234...5678"
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

/**
 * Normalize an address to lowercase
 *
 * @param address - Address to normalize
 * @returns Lowercase address or empty string if invalid
 */
export function normalizeAddress(address: string | undefined | null): string {
  if (!address) return "";
  return address.toLowerCase();
}

/**
 * Check if a string is a valid Ethereum address format
 *
 * @param address - String to validate
 * @returns true if it looks like an Ethereum address
 */
export function isValidAddressFormat(address: string | undefined | null): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
