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
  due: 8,
  units: { hours: { done: 25, of: 52 }, rides: { done: 9, of: 16 } },
} as const;

/**
 * Kept rate for the live season, rendered publicly only above the disclosure
 * threshold (≥5 due commitments and ≥3 distinct providers, UX:350). Derived so it can
 * never contradict the counts printed beside it.
 */
export const SEASON_LIVE_KEPT_RATE = Math.round((SEASON_LIVE.kept / SEASON_LIVE.due) * 100);

/**
 * The same cycle after it closes. Terminal outcomes partition the total:
 * kept + expired + cancelled === made.
 */
export const SEASON_CLOSED = {
  made: 14,
  kept: 11,
  expired: 2,
  cancelled: 1,
  due: 13,
  units: 61,
  hours: { done: 40, of: 52 },
  rides: { done: 14, of: 16 },
} as const;

/**
 * Cycles this pool has already finished, newest first. The public garden page
 * shows a garden's record across seasons and campaigns rather than one live
 * cycle (UX §7.1, 2026-08-20), so the demo garden needs a history to show.
 * Campaigns sit in the same list as seasons and never masquerade as one (§4.2).
 */
export const PRIOR_CYCLES = [
  { name: "Summer Mutirão", type: "campaign", window: "Dec 2025 – Feb 2026", made: 6, kept: 5, due: 6 },
  { name: "Season of Repair", type: "season", window: "Jun – Nov 2025", made: 12, kept: 10, due: 11 },
  { name: "Season of Planting", type: "season", window: "Dec 2024 – May 2025", made: 11, kept: 9, due: 10 },
] as const;

const priorMade = PRIOR_CYCLES.reduce((n, c) => n + c.made, 0);
const priorKept = PRIOR_CYCLES.reduce((n, c) => n + c.kept, 0);
const priorDue = PRIOR_CYCLES.reduce((n, c) => n + c.due, 0);

/**
 * The garden's record while the current season is still running — what the
 * public page publishes today. Derived from the finished cycles plus the live
 * one, so it can never contradict either the rows beneath it or the live
 * cycle's own counts.
 */
export const POOL_RECORD_LIVE = {
  seasons: PRIOR_CYCLES.filter((c) => c.type === "season").length + 1,
  campaigns: PRIOR_CYCLES.filter((c) => c.type === "campaign").length,
  made: priorMade + SEASON_LIVE.made,
  kept: priorKept + SEASON_LIVE.kept,
  due: priorDue + SEASON_LIVE.due,
} as const;

export const POOL_RECORD_LIVE_KEPT_RATE = Math.round(
  (POOL_RECORD_LIVE.kept / POOL_RECORD_LIVE.due) * 100,
);

/**
 * Pool lifetime, at the moment the current season closes: the finished cycles
 * plus that season's closed total. Same derivation as POOL_RECORD_LIVE, one
 * lifecycle step later — the only reason the two differ.
 */
export const POOL_LIFETIME = {
  seasons: POOL_RECORD_LIVE.seasons,
  campaigns: POOL_RECORD_LIVE.campaigns,
  made: priorMade + SEASON_CLOSED.made,
  kept: priorKept + SEASON_CLOSED.kept,
  due: priorDue + SEASON_CLOSED.due,
} as const;

export const POOL_LIFETIME_KEPT_RATE = Math.round(
  (POOL_LIFETIME.kept / POOL_LIFETIME.due) * 100,
);

export const FINISHED_CYCLES = [
  {
    name: CYCLE,
    type: "season",
    window: "Mar – Aug 2026",
    made: SEASON_CLOSED.made,
    kept: SEASON_CLOSED.kept,
    due: SEASON_CLOSED.due,
  },
  ...PRIOR_CYCLES,
] as const;

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
