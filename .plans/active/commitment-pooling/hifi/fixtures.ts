// Single source for the Rocinha / Season of First Rains demo data (PRD-760).
//
// Before this module the same season's totals were typed literally into six
// files and had drifted apart: the pool's lifetime read 23 commitments while the
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
 * threshold (≥5 due commitments and ≥3 commitmentrs, UX:350). Derived so it can
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

/**
 * What the pool HOLDS right now — the thing the console never showed.
 *
 * This is pool scope (`CommitmentUnitSummary` rows with `scope: POOL`), so it
 * contains the live season AND every campaign beside it. Each row is one exact
 * unit label: identity is keccak256 of the stored UTF-8 bytes, so "hours" and
 * "Hours" are deliberately different rows and are never folded together.
 *
 * These rows are NEVER summed. Appendix D.1 bans cross-basis aggregation, and
 * there is no shared denominator that could make 27 hours and 12 rides into one
 * number without inventing a price. The source model's single-figure ring is a
 * price-like abstraction we do not have; the constraint makes this block more
 * truthful, not less complete.
 */
export const POOL_HOLDINGS = {
  units: [
    { label: "hours", open: 40, people: 6 },
    { label: "rides", open: 12, people: 4 },
    { label: "seedling trays", open: 18, people: 3 },
    { label: "tool loans", open: 5, people: 2 },
  ],
  /**
   * The settlement side — the garden Safe, framed as "the pool's reserve"
   * (Appendix D.5). Deliberately small next to the capacity above: what the
   * pool can do for its members does not depend on what is in here, and a
   * reserve reading zero is a normal, working pool rather than a broken one.
   */
  reserve: { amount: "120 G$", plans: 1 },
} as const;

// The closed season's outcomes must account for every commitment made. Checked on
// import so an edit that breaks the arithmetic fails the artifact build rather
// than shipping a season whose parts don't sum to its total.
const { made, kept, expired, cancelled } = SEASON_CLOSED;
if (kept + expired + cancelled !== made)
  throw new Error(
    `fixtures: SEASON_CLOSED does not partition — ${kept} kept + ${expired} expired + ${cancelled} cancelled != ${made} made`,
  );

// Pool scope CONTAINS cycle scope. Whatever a label still has open in the live
// season must therefore also be open at pool level — otherwise the holdings
// block and the season card beside it describe the same moment and disagree,
// which is the exact class of drift this file exists to prevent.
for (const [label, { done, of }] of Object.entries(SEASON_LIVE.units)) {
  const seasonOpen = of - done;
  const poolOpen = POOL_HOLDINGS.units.find((u) => u.label === label)?.open;
  if (poolOpen === undefined)
    throw new Error(`fixtures: POOL_HOLDINGS is missing "${label}", which the live season still has open`);
  if (poolOpen < seasonOpen)
    throw new Error(
      `fixtures: POOL_HOLDINGS "${label}" holds ${poolOpen} open, fewer than the ${seasonOpen} still open in the season it contains`,
    );
}
