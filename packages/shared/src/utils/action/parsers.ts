/**
 * Action ID Parser Utilities
 *
 * Centralized utilities for parsing composite action IDs.
 * Action IDs follow the format: `{chainId}-{actionUID}`
 *
 * @module utils/action/parsers
 */

/**
 * Parse the numeric actionUID from a composite action ID.
 *
 * @param compositeId - The composite ID in format `{chainId}-{actionUID}`
 * @returns The numeric actionUID, or null if parsing fails
 *
 * @example
 * parseActionUID("84532-42") // returns 42
 * parseActionUID("invalid") // returns null
 */
export function parseActionUID(compositeId: string | undefined | null): number | null {
  if (!compositeId) return null;
  const part = String(compositeId).split("-").pop();
  if (!part) return null;
  const num = Number(part);
  return Number.isFinite(num) ? num : null;
}

/**
 * Find an action by its numeric UID from a list of actions.
 *
 * @param actions - Array of actions to search
 * @param uid - The numeric actionUID to find
 * @returns The matching action, or null if not found
 *
 * @example
 * const action = findActionByUID(actions, 42);
 * if (action) {
 *   console.log(action.title);
 * }
 */
export function findActionByUID(actions: Action[], uid: number | null): Action | null {
  if (uid === null || !actions?.length) return null;
  return actions.find((a) => parseActionUID(a.id) === uid) ?? null;
}

/**
 * Get the action title by UID, with optional fallback.
 *
 * @param actions - Array of actions to search
 * @param uid - The numeric actionUID
 * @param fallback - Fallback title if action not found
 * @returns The action title or fallback
 */
export function getActionTitle(
  actions: Action[],
  uid: number | null,
  fallback = "Unknown Action"
): string {
  const action = findActionByUID(actions, uid);
  return action?.title ?? fallback;
}

/**
 * Build a composite action ID from chain ID and action UID.
 *
 * @param chainId - The chain ID
 * @param actionUID - The action UID
 * @returns Composite ID in format `{chainId}-{actionUID}`
 */
export function buildActionId(chainId: number, actionUID: number): string {
  return `${chainId}-${actionUID}`;
}
