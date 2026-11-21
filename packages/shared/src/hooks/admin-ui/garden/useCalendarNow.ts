import { useCallback, useEffect, useState } from "react";
import { useDocumentEvent, useWindowEvent } from "../../utils/useEventListener";
import { useTimeout } from "../../utils/useTimeout";

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * "Now" for a calendar screen: one instant that holds for the whole local day, so a count
 * cannot shift mid-read, and moves on once the day turns. An installed Hub left open overnight
 * otherwise keeps marking yesterday as today and the new day as still to come. It moves at
 * local midnight, and when the page comes back into view, since a hidden tab's timer may sleep
 * past midnight.
 */
export function useCalendarNow(): Date {
  const [now, setNow] = useState(() => new Date());
  // Counts every check, which re-arms the midnight timer even when the day has not turned:
  // a clock or time-zone change can wake it early.
  const [checks, setChecks] = useState(0);
  const { set } = useTimeout();

  const refresh = useCallback(() => {
    const next = new Date();
    setNow((current) => (isSameLocalDay(current, next) ? current : next));
    setChecks((count) => count + 1);
  }, []);

  useEffect(() => {
    const at = new Date();
    const nextMidnight = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1);
    // A second past midnight, so the new instant is surely on the new day.
    return set(refresh, Math.max(1_000, nextMidnight.getTime() - at.getTime() + 1_000));
  }, [checks, refresh, set]);

  useDocumentEvent("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
  useWindowEvent("focus", refresh);

  return now;
}
