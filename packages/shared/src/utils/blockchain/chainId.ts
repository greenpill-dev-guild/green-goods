/**
 * Extracts the numeric ID from a chain-appended string ID
 * Format: "id-chainId" -> id
 * Example: "123-42161" -> 123
 */
export function extractIdFromChainString(chainString: string): number {
  const parts = chainString.split("-");
  if (parts.length === 0) return 0;

  // Take the first part as the ID (before the chain append)
  const id = parseInt(parts[0], 10);
  return isNaN(id) ? 0 : id;
}

/**
 * Compares a chain-appended string ID with a numeric ID
 * Example: compareChainId("123-42161", 123) -> true
 */
export function compareChainId(chainString: string, numericId: number): boolean {
  return extractIdFromChainString(chainString) === numericId;
}
