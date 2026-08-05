// Single source for the Rocinha / Season of First Rains demo data (PRD-760).
//
// Before this module the same season's totals were typed literally into six
// files and had drifted apart: the pool's lifetime read 23 promises while the
// only season it contained read 14, and the cancel branch read 8 where the live
// season read 9. A reviewer moving between two screens saw two different
// gardens. Every screen that prints a total for this garden now reads it from
// here, so two surfaces describing the same moment and scope cannot disagree.
//
// The rule this encodes: a number may differ between screens ONLY when the
// lifecycle state, cycle, campaign, or scope differs — and the screen says so.

export const GARDEN = "Rocinha Community Garden";
export const CYCLE = "Season of First Rains";

/**
 * The cycle while it is still open — the moment most screens show.
 * Used by the garden home, the public pool page, the wallet summary, the
 * settlement roll-up, and the cancel-season confirmation (which cancels *this*
 * season, so it must show these same totals).
 */
export const SEASON_LIVE = {
  made: 9,
  kept: 7,
  units: { hours: { done: 25, of: 52 }, rides: { done: 9, of: 16 } },
} as const;

/**
 * Kept rate for the live season, rendered publicly only above the disclosure
 * threshold (≥5 due commitments and ≥3 promisers, UX:350). Derived so it can
 * never contradict the counts printed beside it.
 */
export const SEASON_LIVE_KEPT_RATE = Math.round((SEASON_LIVE.kept / SEASON_LIVE.made) * 100);

/**
 * The same cycle after it closes. Terminal outcomes partition the total:
 * kept + expired + cancelled === made.
 */
export const SEASON_CLOSED = {
  made: 14,
  kept: 11,
  expired: 2,
  cancelled: 1,
  units: 61,
  hours: { done: 40, of: 52 },
  rides: { done: 14, of: 16 },
} as const;

/**
 * Pool lifetime. The demo pool has run exactly one season, so its lifetime
 * total IS that season's closed total — it is not an independent number.
 * Deriving it here is what keeps the two reconciled.
 */
export const POOL_LIFETIME = {
  seasons: 1,
  made: SEASON_CLOSED.made,
  kept: SEASON_CLOSED.kept,
} as const;

// The closed season's outcomes must account for every promise made. Checked on
// import so an edit that breaks the arithmetic fails the artifact build rather
// than shipping a season whose parts don't sum to its total.
const { made, kept, expired, cancelled } = SEASON_CLOSED;
if (kept + expired + cancelled !== made)
  throw new Error(
    `fixtures: SEASON_CLOSED does not partition — ${kept} kept + ${expired} expired + ${cancelled} cancelled != ${made} made`,
  );
