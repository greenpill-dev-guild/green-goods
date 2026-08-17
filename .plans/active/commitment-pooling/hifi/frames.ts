// Frame grouping for the state switcher (2026-08-16 round 7).
//
// W2 carried 75 states, W1 33, W7 31, and the switcher drew them as one flat row
// of chips — which is what made the surface feel impossible to hold in a head.
// They are not that many screens. They are one commitment lifecycle replayed across
// six kinds of commitment, one setup ladder a pool climbs once, and a row of
// confirmations. Grouping the chips by FRAME says so.
//
// The states themselves never move: prototypes.md §17 is a coverage appendix
// asserting every spec state is walked, and hifi/validate.ts enforces registry
// integrity against it. Presentations merge; the ledger stays exactly as long as
// it was.

/**
 * Order states so each frame's members sit together, without disturbing which
 * state is the screen's default.
 *
 * Frame order is taken from declaration order, and the sort is stable — so the
 * first declared state's frame leads, that state stays first within it, and
 * every frame keeps its authored internal sequence.
 */
export function groupStates<T extends { group?: string }>(states: T[]): T[] {
  const order: string[] = [];
  for (const s of states) if (s.group && !order.includes(s.group)) order.push(s.group);
  if (order.length === 0) return states;
  return [...states].sort((a, b) => order.indexOf(a.group ?? "") - order.indexOf(b.group ?? ""));
}
