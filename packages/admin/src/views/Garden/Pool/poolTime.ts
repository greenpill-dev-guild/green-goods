/**
 * How the pool console writes a moment (PRD-1025 D3): always in the viewer's
 * own zone, with the locale choosing 12 or 24 hours, and never seconds. Queue
 * ages read relative, with the exact moment behind them; anything decided this
 * visit reads as a clock time; an exact deadline carries its date, time and
 * zone.
 */

import type { IntlShape } from "react-intl";

type Formats = Pick<IntlShape, "formatDate" | "formatTime">;

/** "Sat, Sep 26, 2026, 10:05 AM PDT": the full moment, for a title or an exact deadline. */
export function exactTime(intl: Formats, ms: number): string {
  return intl.formatDate(ms, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** "3:42 PM", or "15:42" where the locale reads 24 hours: for what happened this visit. */
export function clockTime(intl: Formats, ms: number): string {
  return intl.formatTime(ms, { hour: "numeric", minute: "2-digit" });
}

/** The machine-readable moment a `<time>` carries. */
export function isoTime(ms: number): string {
  return new Date(ms).toISOString();
}
