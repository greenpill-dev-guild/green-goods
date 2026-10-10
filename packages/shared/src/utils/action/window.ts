/**
 * Action windows. An action takes Work only between its startTime and its
 * endTime, both inclusive epoch milliseconds (getActions converts the indexer's
 * seconds); Work.sol refuses Work outside that window.
 *
 * @module utils/action/window
 */

import type { ActionCard } from "../../types/domain";

type ActionWindow = Pick<ActionCard, "startTime" | "endTime">;

/** The longest delay setTimeout honours; browsers run a longer one at once. */
const LONGEST_TIMER_DELAY_MS = 2_147_483_647;

/** Whether the action takes Work at `now`. */
export function isActionOpen(action: ActionWindow, now: number): boolean {
  return now >= action.startTime && now <= action.endTime;
}

/** Whether the action's window has ended by `now`, so it takes no more Work. */
export function hasActionEnded(action: ActionWindow, now: number): boolean {
  return now > action.endTime;
}

/**
 * How long until any of these actions opens or ends, or null when none will.
 * A far change is capped at the longest timer delay, so a clock waiting on it
 * wakes early and waits again instead of firing at once.
 */
export function msUntilActionWindowChange(
  actions: readonly ActionWindow[],
  now: number
): number | null {
  const changes = actions.flatMap((action) => {
    if (now < action.startTime) return [action.startTime];
    if (now <= action.endTime) return [action.endTime + 1];
    return [];
  });
  if (changes.length === 0) return null;
  return Math.min(Math.min(...changes) - now, LONGEST_TIMER_DELAY_MS);
}
