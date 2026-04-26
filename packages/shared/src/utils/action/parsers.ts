/**
 * Centralized utilities for parsing composite action IDs.
 * Action IDs follow the format: `{chainId}-{actionUID}`.
 *
 * @module utils/action/parsers
 */

import type { Action } from "../../types/domain";

/**
 * @example
 * parseActionUID("11155111-42") // returns 42
 * parseActionUID("invalid") // returns null
 */
export function parseActionUID(compositeId: string | undefined | null): number | null {
  if (!compositeId) return null;
  const part = String(compositeId).split("-").pop();
  if (!part) return null;
  const num = Number(part);
  return Number.isFinite(num) ? num : null;
}

export function findActionByUID(actions: Action[], uid: number | null): Action | null {
  if (uid === null || !actions?.length) return null;
  return actions.find((a) => parseActionUID(a.id) === uid) ?? null;
}

export function getActionTitle(
  actions: Action[],
  uid: number | null,
  fallback = "Unknown Action"
): string {
  const action = findActionByUID(actions, uid);
  return action?.title ?? fallback;
}

export function buildActionId(chainId: number, actionUID: number): string {
  return `${chainId}-${actionUID}`;
}
