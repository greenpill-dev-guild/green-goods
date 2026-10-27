import type { BookingHistoryAnchor } from "./serviceBookingTypes";

export type HistoryEntry<C, B> = { core: C } | { booking: B };

/**
 * The promise's events and a booking's steps in one History, newest first. A step that is one of
 * the promise's own events (agreeing is its claim request, acceptance its acceptance) sits just
 * above that event's line. Every other step happened after the step before it, so it sits with
 * that step, above the same line: anything the promise recorded later, such as a confirmation
 * while a transfer is still on its way, stays above it, even when both landed in one block.
 *
 * `core` and `booking` both come newest first, as History draws them; each core line names the
 * events it stands for (a confirmation that kept the promise is both).
 */
export function orderHistory<
  C extends { eventTypes: readonly string[] },
  B extends { anchor?: BookingHistoryAnchor },
>(core: readonly C[], booking: readonly B[]): HistoryEntry<C, B>[] {
  // Where each event's latest line sits; the newest comes first.
  const position = new Map<string, number>();
  core.forEach((line, index) => {
    for (const type of line.eventTypes) if (!position.has(type)) position.set(type, index);
  });
  // Steps above each line, newest first; the last slot is below every line.
  const slots: B[][] = Array.from({ length: core.length + 1 }, () => []);
  let slot = core.length;
  for (const line of [...booking].reverse()) {
    const own = line.anchor ? position.get(line.anchor) : undefined;
    // Never below the step before it, whatever its own event says.
    if (own !== undefined) slot = Math.min(own, slot);
    slots[slot]!.unshift(line);
  }
  return [
    ...core.flatMap((line, index): HistoryEntry<C, B>[] => [
      ...slots[index]!.map((step) => ({ booking: step })),
      { core: line },
    ]),
    ...slots[core.length]!.map((step) => ({ booking: step })),
  ];
}
