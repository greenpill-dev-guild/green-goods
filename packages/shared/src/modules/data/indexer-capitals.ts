import { type Action, Capital } from "../../types/domain";

/**
 * Maps an indexer capital to a known capital. The hosted indexer returns enum
 * names ("MATERIAL"); fixtures and older deployments return numbers. Anything
 * else, including the indexer's UNKNOWN sentinel, is null.
 */
export function parseIndexerCapital(value: unknown): Capital | null {
  const index = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  // A numeric enum maps each name to its number and each number back to its name.
  const capital = typeof index === "string" ? Capital[index as keyof typeof Capital] : index;
  return typeof capital === "number" && Capital[capital] !== undefined ? capital : null;
}

/**
 * The actions with only known capitals. A reading cache written before the
 * indexer's names were parsed still holds them, and restoring it skips the
 * fetch that parses, so the list hooks apply this to cached data too. Returns
 * the same array when nothing changed.
 */
export function withKnownCapitals(actions: Action[]): Action[] {
  let changed = false;
  const known = actions.map((action) => {
    const raw: unknown[] = Array.isArray(action.capitals) ? action.capitals : [];
    const capitals = raw.map(parseIndexerCapital).filter((capital) => capital !== null);
    const unchanged =
      raw === action.capitals &&
      capitals.length === raw.length &&
      capitals.every((capital, i) => capital === raw[i]);
    if (unchanged) return action;
    changed = true;
    return { ...action, capitals };
  });
  return changed ? known : actions;
}
