import type { BookingHistoryAnchor } from "./serviceBookingTypes";

/** When each anchor event last happened, from the promise's own History read. */
export type AnchorTimes = Partial<Record<BookingHistoryAnchor, number>>;

const ANCHORS: ReadonlySet<string> = new Set<BookingHistoryAnchor>([
  "CLAIM_REQUESTED",
  "ACCEPTED",
  "READY_FOR_CONFIRMATION",
  "FULFILLED",
  "CANCELLED",
]);

/** The latest time of each event a booking step can be the same act as. */
export function anchorTimes(
  events: readonly { eventType: string; timestamp: number }[]
): AnchorTimes {
  const times: AnchorTimes = {};
  for (const event of events) {
    if (!ANCHORS.has(event.eventType)) continue;
    const anchor = event.eventType as BookingHistoryAnchor;
    times[anchor] = Math.max(times[anchor] ?? Number.NEGATIVE_INFINITY, event.timestamp);
  }
  return times;
}

export type HistoryEntry<C, B> = { core: C } | { booking: B };

/**
 * The promise's events and a booking's steps in one History, newest first. A step that is one of
 * the promise's own events (agreeing is its claim request, acceptance its acceptance) takes that
 * event's time. Every other step happened after the step before it, so it takes that time and
 * sorts above whatever the promise recorded then; anything the promise recorded later, such as a
 * confirmation while a transfer is still on its way, sorts above it.
 *
 * `core` and `booking` both come newest first, as History draws them.
 */
export function orderHistory<C extends { at: number }, B extends { anchor?: BookingHistoryAnchor }>(
  core: readonly C[],
  booking: readonly B[],
  times: AnchorTimes
): HistoryEntry<C, B>[] {
  let last = Number.NEGATIVE_INFINITY;
  const steps = [...booking].reverse().map((line, sequence) => {
    const own = line.anchor ? times[line.anchor] : undefined;
    // Never earlier than the step before it, whatever its own event says.
    last = own === undefined ? last : Math.max(own, last);
    return { at: last, rank: 1, order: sequence, entry: { booking: line } };
  });
  const events = core.map((line, index) => ({
    at: line.at,
    rank: 0,
    order: -index,
    entry: { core: line },
  }));
  return [...events, ...steps]
    .sort((a, b) => b.at - a.at || b.rank - a.rank || b.order - a.order)
    .map(({ entry }) => entry as HistoryEntry<C, B>);
}
