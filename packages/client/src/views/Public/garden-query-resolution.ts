import { type PublicGardenSummary, publicGardenHelpers } from "@green-goods/shared";

export type ResolutionStatus = "absent" | "match" | "stale" | "ambiguous";

export interface ResolvedGarden {
  status: ResolutionStatus;
  garden?: PublicGardenSummary;
  rawQuery?: string;
}

/**
 * Resolves the public `?garden=` query against the loaded list of public
 * gardens. Returns `match` when an id, address, or unique slug match is found,
 * `ambiguous` when more than one slug matches, `stale` when the query is
 * non-empty but matches nothing, and `absent` for empty/missing queries.
 *
 * Extracted from `Fund.tsx` so it can be unit-tested without pulling the view's
 * wallet runtime imports through the test transformer.
 */
export function resolveGardenQuery(
  rawQuery: string | null,
  gardens: readonly PublicGardenSummary[]
): ResolvedGarden {
  if (!rawQuery) return { status: "absent" };
  const trimmed = rawQuery.trim();
  if (trimmed.length === 0) return { status: "absent" };

  const lower = trimmed.toLowerCase();
  const exact = gardens.find(
    (garden) => garden.id.toLowerCase() === lower || garden.address.toLowerCase() === lower
  );
  if (exact) return { status: "match", garden: exact, rawQuery: trimmed };

  const slugMatches = gardens.filter(
    (garden) => publicGardenHelpers.deriveSlug(garden.name, garden.id) === lower
  );
  if (slugMatches.length === 1) {
    return { status: "match", garden: slugMatches[0], rawQuery: trimmed };
  }
  if (slugMatches.length > 1) {
    return { status: "ambiguous", rawQuery: trimmed };
  }
  return { status: "stale", rawQuery: trimmed };
}
